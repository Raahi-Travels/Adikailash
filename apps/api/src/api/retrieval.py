"""Search over approved content, for the assistant to ground answers in.

Doc 08 lists "search over approved journey, guide and policy knowledge" as a suitable
early use of AI, and requires "retrieval from approved current data". The operative
word is *approved*: a draft article, an unpublished journey and a superseded policy
are all invisible here. Nothing reaches the model that a traveller could not already
read on the site.

**Postgres full-text search, not a vector store, and the reason is decision D6.**
`pgvector` is installed with `CREATE EXTENSION`, which is database-wide — on a
database shared with Raahi's production application. The shared-database rules exist
precisely to stop this codebase making changes with blast radius outside the `yatra`
schema, and installing an extension to improve our own search would be exactly that.

Postgres native FTS needs no extension and is genuinely well suited to this corpus:
a few dozen guides and journeys written in two languages, where the questions are
concrete ("inner line permit", "Gunji", "cancellation") rather than semantically
oblique. If the corpus grows to where lexical search stops working, a separate vector
service outside this database is the right answer — not an extension on Raahi's.
"""

from __future__ import annotations

import re

from sqlalchemy import Float, cast, func, literal, or_, select
from sqlalchemy.dialects.postgresql import REGCONFIG
from sqlalchemy.ext.asyncio import AsyncSession

from api.domain.assist import Passage, StatusFact
from api.localization import resolve
from api.models.catalogue import Journey
from api.models.content import Article, ArticleFaq, ArticleState
from api.models.operations import RouteSegment, StatusUpdate

def _config():
    """The Postgres text-search configuration, typed correctly.

    Cast to `REGCONFIG` rather than passed as a string. `to_tsvector` has no
    `(varchar, text)` overload, and SQLAlchemy binds a plain literal as VARCHAR, so
    the query fails with "function to_tsvector(character varying, text) does not
    exist" — a signature error that appears only on the first real search.

    Built fresh per call rather than held as a module constant, so no bound
    expression is shared between statements.

    English stemming applied to Hindi text is harmless: it will not stem, and exact
    token matching still works, which is what a place name needs anyway.
    """
    return cast(literal("english"), REGCONFIG)


#: Words that carry no retrieval signal in a question. Not a full stopword list —
#: Postgres strips those itself — just the interrogative scaffolding people wrap a
#: question in, which would otherwise be ANDed against the corpus and match nothing.
_QUESTION_WORDS = frozenset(
    {
        "where", "what", "when", "which", "who", "why", "how", "do", "does", "did",
        "is", "are", "was", "were", "can", "could", "should", "would", "will",
        "the", "a", "an", "i", "we", "you", "my", "our", "your", "me", "us",
        "to", "for", "of", "in", "on", "at", "from", "with", "and", "or",
        "get", "need", "have", "there", "it", "this", "that", "please", "tell",
    }
)


def _terms(question: str) -> list[str]:
    """Content words from a question, safe to put in a tsquery.

    Non-alphanumerics are stripped rather than escaped: a stray quote or ampersand in
    a pasted WhatsApp message is a tsquery syntax error, and there is nothing a
    traveller could type that we want to interpret as query syntax.
    """
    words = re.findall(r"[A-Za-z0-9]+", question.lower())
    kept = [w for w in words if len(w) > 2 and w not in _QUESTION_WORDS]
    return kept or [w for w in words if len(w) > 2]


def _tsquery(question: str):
    """Terms ORed together, ranked by how many match.

    `plainto_tsquery` ANDs every word, which is wrong for a natural question: "Where
    do I get the inner line permit?" became `get & inner & line & permit`, and a guide
    titled "Where is the inner line permit issued?" scored nothing because it never
    says "get". The question is a sentence, not a boolean expression.

    ORing lets partial matches through and leaves the ordering to `ts_rank`, which
    already weights a document matching four terms above one matching two — which is
    the behaviour the AND was clumsily reaching for.
    """
    terms = _terms(question)
    if not terms:
        return func.plainto_tsquery(_config(), question)
    return func.to_tsquery(_config(), literal(" | ".join(terms)))


def _rank(haystack, question: str):
    return func.ts_rank(func.to_tsvector(_config(), haystack), _tsquery(question))


def _matches(haystack, question: str):
    return func.to_tsvector(_config(), haystack).op("@@")(_tsquery(question))


async def search_articles(
    session: AsyncSession, question: str, locale: str, *, limit: int = 4
) -> list[Passage]:
    """Published guides, ranked.

    Searches the standalone `answer` rather than the whole body. That field exists
    (doc 07's AEO pattern) as the self-contained 40-80 word passage an answer engine
    would lift, which makes it exactly the right unit to hand a model: enough to
    answer from, short enough that several fit, and already written to stand alone
    without the paragraph before it.
    """
    text = func.concat_ws(
        " ",
        Article.title.op("->>")("en"),
        Article.answer.op("->>")("en"),
    )
    rows = await session.execute(
        select(Article, cast(_rank(text, question), Float).label("score"))
        .where(Article.state == ArticleState.PUBLISHED, _matches(text, question))
        .order_by(_rank(text, question).desc())
        .limit(limit)
    )
    return [
        Passage(
            kind="guide",
            title=resolve(article.title, locale) or article.slug,
            text=resolve(article.answer, locale) or "",
            source_ref=f"guide:{article.slug}",
            url_path=f"/guides/{article.slug}",
            last_reviewed_at=article.last_reviewed_at,
            score=float(score or 0),
        )
        for article, score in rows.all()
    ]


async def search_faqs(
    session: AsyncSession, question: str, locale: str, *, limit: int = 4
) -> list[Passage]:
    """FAQ rows from published guides.

    Often the best match: doc 07 says these come from "actual conversations", so a
    traveller's phrasing tends to be closer to an FAQ question than to a guide title.
    """
    text = func.concat_ws(
        " ",
        ArticleFaq.question.op("->>")("en"),
        ArticleFaq.answer.op("->>")("en"),
    )
    rows = await session.execute(
        select(ArticleFaq, Article.slug, cast(_rank(text, question), Float).label("score"))
        .join(Article, Article.id == ArticleFaq.article_id)
        .where(Article.state == ArticleState.PUBLISHED, _matches(text, question))
        .order_by(_rank(text, question).desc())
        .limit(limit)
    )
    return [
        Passage(
            kind="faq",
            title=resolve(faq.question, locale) or "",
            text=resolve(faq.answer, locale) or "",
            source_ref=f"guide:{slug}#faq-{faq.id}",
            url_path=f"/guides/{slug}",
            score=float(score or 0),
        )
        for faq, slug, score in rows.all()
    ]


async def search_journeys(
    session: AsyncSession, question: str, locale: str, *, limit: int = 3
) -> list[Passage]:
    text = func.concat_ws(
        " ",
        Journey.name.op("->>")("en"),
        Journey.essence.op("->>")("en"),
        Journey.gateway,
    )
    rows = await session.execute(
        select(Journey, cast(_rank(text, question), Float).label("score"))
        .where(Journey.is_published.is_(True), _matches(text, question))
        .order_by(_rank(text, question).desc())
        .limit(limit)
    )
    return [
        Passage(
            kind="journey",
            title=resolve(journey.name, locale) or journey.slug,
            text=(resolve(journey.essence, locale) or "")
            + (
                f" Gateway: {journey.gateway}."
                if journey.gateway
                else ""
            )
            + (
                f" {journey.duration_nights} nights."
                if journey.duration_nights
                else ""
            ),
            source_ref=f"journey:{journey.slug}",
            url_path=f"/journeys/{journey.slug}",
            last_reviewed_at=journey.last_reviewed_at,
            score=float(score or 0),
        )
        for journey, score in rows.all()
    ]


async def latest_status(
    session: AsyncSession, question: str, locale: str
) -> StatusFact | None:
    """The most recent verified status for whichever segment the question names.

    **Returns None unless the question names a segment**, and that is the whole
    point. An earlier version fell back to the most recently verified segment when no
    name matched, so "Is the road to Gunji open?" was answered with the status of
    Kathgodam to Pithoragarh — a different stretch of road, quoted confidently, with
    a real timestamp and a real verifier attached to make it convincing.

    A wrong-segment answer is worse than no answer here, because everything that
    makes the record trustworthy is still present and pointing at the wrong thing.
    With no match the assistant refuses and the coordinator sends the status page,
    which shows every segment.
    """
    named = await session.scalar(
        select(RouteSegment).where(
            or_(
                _matches(RouteSegment.name.op("->>")("en"), question),
                _matches(RouteSegment.slug, question),
            )
        )
    )
    if named is None:
        return None

    update = await session.scalar(
        select(StatusUpdate)
        .where(StatusUpdate.route_segment_id == named.id)
        .order_by(StatusUpdate.verified_at.desc())
        .limit(1)
    )
    if update is None:
        return None

    segment = named

    return StatusFact(
        segment_name=resolve(segment.name, locale) or segment.slug,
        access=update.access,
        summary=resolve(update.summary, locale),
        verified_at=update.verified_at,
        verified_by=update.verified_by,
        source=update.source,
    )


async def retrieve(
    session: AsyncSession, question: str, locale: str = "en"
) -> list[Passage]:
    """Everything approved that matches, best first.

    Merged from three searches rather than one union query: the three corpora rank on
    different text and a single `ts_rank` across them would let a long journey essence
    outscore the FAQ that actually answers the question.
    """
    found = [
        *await search_faqs(session, question, locale),
        *await search_articles(session, question, locale),
        *await search_journeys(session, question, locale),
    ]
    return sorted(found, key=lambda p: p.score, reverse=True)
