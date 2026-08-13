"""The content hub (Phase 4, doc 07).

Doc 07's growth thesis is that authority comes from "the most truthful and useful
local guidance", and its citation-worthiness rule is that a page earns a citation
when it carries information others do not have. That shapes this schema more than any
SEO convention does.

**Every article names a human and a date.** `author` and `reviewed_by` are required
before publication, and `last_reviewed_at` is a real review, not a build timestamp.
Doc 07's local-evidence list is explicit: "named local authors and reviewers, update
timestamps". A guide about permit paperwork with no name on it is exactly the
commodity content already flooding page one.

**Answer-first is enforced by the schema, not by discipline.** `answer` is a required
field separate from `body`: a standalone, self-contained response to the question in
the title. That is the passage an answer engine extracts, and making it a column
rather than a convention means nobody can publish a guide that buries the answer in
paragraph nine.

**Freshness is claimed honestly.** `review_interval_days` is a commitment to
re-check, exactly as route status works. An article past its interval renders as
"not recently reviewed" rather than quietly presenting last season's road conditions
as current. Doc 07's guardrail: "Do not mark content as live when it is not
regularly verified."

Bodies are localised JSONB, same as journeys (decision D9), so operations edits
content without a deploy.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.db import Base, LocalizedText, TimestampMixin, pg_enum, requires_english


class ArticleCluster(enum.StrEnum):
    """Doc 07's search intent clusters, as the site's actual information architecture.

    Named after intent rather than topic because that is how the pages have to be
    written: a "route and status" piece answers a different question from a
    "preparation" piece even when both are about the same stretch of road.
    """

    ROUTE_AND_STATUS = "route_and_status"
    PREPARATION = "preparation"
    COST_AND_TIERS = "cost_and_tiers"
    ACCOMMODATION = "accommodation"
    GATEWAY_AND_TRANSPORT = "gateway_and_transport"
    HEALTH_AND_ALTITUDE = "health_and_altitude"
    CULTURE_AND_TRADITION = "culture_and_tradition"
    FIELD_REPORT = "field_report"


class ArticleState(enum.StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PUBLISHED = "published"
    #: Withdrawn deliberately. Distinct from draft: it was public and is not now.
    RETIRED = "retired"


class Article(Base, TimestampMixin):
    """One guide."""

    __tablename__ = "articles"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_articles_slug"),
        requires_english("title"),
        requires_english("answer"),
        # Doc 07: named local authors and reviewers. Enforced at the point it
        # matters — publication — rather than on every draft.
        CheckConstraint(
            "state <> 'published' or ("
            "length(trim(coalesce(author, ''))) > 0"
            " and length(trim(coalesce(reviewed_by, ''))) > 0"
            " and last_reviewed_at is not null)",
            name="published_article_needs_named_review",
        ),
        CheckConstraint(
            "review_interval_days > 0", name="review_interval_is_positive"
        ),
        Index("ix_articles_cluster_state", "cluster", "state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(160), nullable=False)

    cluster: Mapped[ArticleCluster] = mapped_column(
        pg_enum(ArticleCluster, "article_cluster"), nullable=False
    )
    state: Mapped[ArticleState] = mapped_column(
        pg_enum(ArticleState, "article_state"),
        nullable=False,
        default=ArticleState.DRAFT,
        server_default=text("'draft'"),
    )

    #: Phrased as the question a person actually types. Doc 07's AEO pattern: "clear
    #: headings matching real questions".
    title: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)

    #: The standalone answer, 40 to 80 words, no pronoun opening, no "however".
    #: Separate from the body on purpose: this is the passage an answer engine lifts,
    #: and a column cannot be quietly skipped the way a writing convention can.
    answer: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)

    body: Mapped[dict[str, Any] | None] = mapped_column(LocalizedText())

    #: Doc 07 requires a "named author or operational reviewer". Two people, because
    #: the person who walked the road and the person who checked the claim are often
    #: not the same, and both matter.
    author: Mapped[str | None] = mapped_column(String(120))
    reviewed_by: Mapped[str | None] = mapped_column(String(120))
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: The re-check commitment that makes the freshness label mean something. Same
    #: mechanism as route status: a claim of currency you have to keep earning.
    review_interval_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=180, server_default=text("180")
    )

    #: Where this sits relative to the catalogue, so a guide can point at the journey
    #: it is about and the internal link is data rather than prose.
    journey_id: Mapped[int | None] = mapped_column(
        ForeignKey("journeys.id", ondelete="SET NULL")
    )

    #: Doc 07 warns against hundreds of near-duplicate pages. A pillar carries the
    #: cluster; supporting pieces point at it.
    is_pillar: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("articles.id", ondelete="SET NULL")
    )

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    internal_note: Mapped[str | None] = mapped_column(Text)

    faqs: Mapped[list[ArticleFaq]] = relationship(
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="ArticleFaq.sort_order",
    )


class ArticleFaq(Base, TimestampMixin):
    """One question and answer on an article.

    Rendered as visible text *and* as `FAQPage` markup. Doc 07: "structured data that
    matches visible content" — the markup is generated from these rows, so the two
    cannot drift. Doc 07 also says the FAQ should be "based on actual conversations",
    which is why `asked_by_traveller` exists: a question somebody really asked is
    worth more than one invented to fill a section.
    """

    __tablename__ = "article_faqs"
    __table_args__ = (
        requires_english("question"),
        requires_english("answer"),
        Index("ix_article_faqs_article", "article_id", "sort_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[int] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    answer: Mapped[dict[str, Any]] = mapped_column(LocalizedText(), nullable=False)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    #: True when this came from a real enquiry rather than being written to fill a
    #: section. Not shown to the reader; it tells an editor which ones are earning.
    asked_by_traveller: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    article: Mapped[Article] = relationship(back_populates="faqs")


class AssistQuery(Base, TimestampMixin):
    """One question put to the assistant, and what it did with it.

    Doc 08's guardrails end with "logging and evaluation", and this is both. Without
    it there is no way to answer the two questions that decide whether the assistant
    is worth keeping: what is it being asked that we have published nothing about,
    and are coordinators actually sending its drafts.

    **The question text is stored; nothing about the traveller is.** No lead id, no
    phone number, no conversation. Doc 08 requires "restricted access to sensitive
    traveller data" and the cheapest way to honour that is for this table never to
    receive any — a coordinator pastes a question, not a person.

    `was_used` is the only quality measure that means anything. A draft nobody sends
    is a bad draft however good it looks in review.
    """

    __tablename__ = "assist_queries"
    __table_args__ = (
        CheckConstraint("length(trim(question)) > 0", name="assist_question_present"),
        Index("ix_assist_queries_created", "created_at"),
        Index("ix_assist_queries_refusal", "refusal"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    question: Mapped[str] = mapped_column(Text, nullable=False)
    asked_by: Mapped[str | None] = mapped_column(String(120))
    locale: Mapped[str] = mapped_column(
        String(8), nullable=False, default="en", server_default=text("'en'")
    )

    #: Null when answered. Otherwise the reason, which is the most useful column here:
    #: a run of `no_grounding` rows is a content backlog, written by real questions.
    refusal: Mapped[str | None] = mapped_column(String(40))
    #: Source refs actually cited, so an answer can be re-checked against what it saw.
    citations: Mapped[list[str] | None] = mapped_column(JSONB)
    passage_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    quoted_status: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    answer: Mapped[str | None] = mapped_column(Text)
    #: Which model wrote it, or null for a retrieval-only response. Comparing answer
    #: quality across a model change is impossible without this.
    model: Mapped[str | None] = mapped_column(String(120))
    contract_version: Mapped[str | None] = mapped_column(String(40))

    #: Set when a coordinator says they sent it. The only quality signal that counts.
    was_used: Mapped[bool | None] = mapped_column(Boolean)
