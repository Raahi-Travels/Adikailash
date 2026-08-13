"""Grounded assistance over approved content (doc 08's AI layer, Phase 5).

Doc 08 states the premise in one line: "AI is an assistant over approved data, not a
source of operational truth." It then lists required guardrails — retrieval from
approved current data, a source reference for operational answers, uncertainty
handling, human takeover, logging. Doc 04 adds what the assistant may never do
independently: confirm route or permit status without an approved current source,
give medical clearance, change price or policy, promise a specific hotel or view,
resolve a complaint, or fabricate urgency or social proof.

**The single most important thing in this module is that refusal happens before the
model is called, not by it.**

`refusal_for()` is a pure function over the question text. A question about somebody's
heart condition is refused by code, deterministically, and the language model never
sees it. This is the opposite of the usual arrangement, where the guardrail is a
paragraph of the system prompt and the model is trusted to honour it — a model that
is having a bad day, or is talked around, then answers a medical question on behalf
of a travel company. Here it cannot, because it is never asked.

The prompt contract still carries the same rules, as a second layer. But the layer
that has to hold is this one, and it holds without a network call.

**Status is the one operational answer allowed**, because doc 04's prohibition is on
confirming it "without an approved current source" and we have one: a record with a
timestamp and a named verifier. It may be quoted with that provenance attached, and
is refused outright once stale — an assistant repeating a four-day-old "open" with
confidence is worse than one that says it does not know.
"""

from __future__ import annotations

import enum
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from api.domain.status import public_attribution

#: A status record older than this is not quoted at all. Deliberately shorter than
#: the status page's own "stale" threshold: a page shows the age beside the claim and
#: lets a reader judge it, whereas an assistant's sentence gets forwarded on its own.
STATUS_QUOTABLE_WITHIN = timedelta(hours=36)

#: Below this retrieval score, we have nothing to ground an answer in and say so.
#: Doc 08 requires "confidence or uncertainty handling"; this is it.
#:
#: Empirical, and corpus-dependent: on these guide lengths `ts_rank` returns roughly
#: 0.03 for one matching term and 0.06 for two. An earlier 0.05 therefore demanded
#: two matches without saying so, and silently dropped "What should I bring for the
#: cold?" against a packing guide that says "cold" — a good single-term match, thrown
#: away by a threshold nobody had measured. Revisit when the corpus grows.
MIN_RETRIEVAL_SCORE = 0.025


class Refusal(enum.StrEnum):
    """Why the assistant will not answer. Each maps to a line in doc 04."""

    #: "Provide medical clearance or diagnosis." Also covers fitness judgements,
    #: which are the same thing wearing a friendlier word.
    MEDICAL = "medical"
    #: "Change price, policy, refund or itinerary commitments."
    COMMERCIAL = "commercial"
    #: "Promise a specific hotel, vehicle or view."
    PROMISE = "promise"
    #: "Resolve a complaint without human ownership."
    COMPLAINT = "complaint"
    #: The status record is too old to quote.
    STATUS_STALE = "status_stale"
    #: Nothing approved matches. Doc 08's uncertainty handling.
    NO_GROUNDING = "no_grounding"


#: Patterns are deliberately broad. A false refusal costs one handover to a human,
#: which is a thing this system does well; a false answer about somebody's heart
#: costs something that cannot be undone. The asymmetry decides the tuning.
_MEDICAL = re.compile(
    r"\b("
    r"fit enough|fit to|fitness|medically|medical(ly)? (fit|clear|ok)|clearance|"
    r"am i (able|ok|safe)|can (i|my|he|she|they|we) (manage|handle|cope|survive)|"
    r"ams|acute mountain|altitude sick|mountain sickness|hape|hace|oxygen|"
    r"heart|cardiac|bp|blood pressure|diabet|asthma|pregnan|surgery|operation|"
    r"medication|medicine|tablet|diamox|acetazolamide|"
    r"is it safe for (me|my|him|her|them)|too old|age limit|my (father|mother|dad|mum|mom|wife|husband|parents?)"
    r")\b",
    re.IGNORECASE,
)

_COMMERCIAL = re.compile(
    r"\b("
    r"discount|cheaper|reduce the price|lower the price|negotiat|"
    r"waive|refund me|get my money|cancel and refund|"
    r"can you (do|make) it for|best price|final price|"
    r"change the (policy|itinerary|price)"
    r")\b",
    re.IGNORECASE,
)

_PROMISE = re.compile(
    r"\b("
    r"guarantee|guaranteed|will i (definitely|certainly|surely)|"
    r"promise|assure me|(definitely|certainly) (see|get|have)|"
    r"which hotel will|exact hotel|specific hotel|same vehicle|"
    r"will the weather|will it be clear|will i see"
    r")\b",
    re.IGNORECASE,
)

_COMPLAINT = re.compile(
    r"\b("
    r"complain|complaint|unacceptable|terrible|worst|"
    r"i want compensation|compensate|demand a refund|"
    r"disappointed|misled|lied to|cheated"
    r")\b",
    re.IGNORECASE,
)

#: Deliberately narrower than "mentions a road or a permit".
#:
#: "Where is the inner line permit issued?" is a *content* question — it asks about
#: process, and the answer is in a guide that does not change day to day. "Are
#: permits being issued right now?" is a status question. An early version matched
#: `permit issued` and swallowed the first one, so a perfectly answerable question
#: about where to get a permit was refused for want of a live road record.
#:
#: The rule: a status question asks what is true *now*. Interrogatives about place
#: and method (where, how, what, which) are asking about the process, so they are
#: excluded even when a road or permit is named.
_PROCESS_QUESTION = re.compile(r"^\s*(where|how|what|which|who|why)\b", re.IGNORECASE)

_STATUS_QUESTION = re.compile(
    r"\b("
    r"road (is )?(open|closed|blocked)|route (is )?(open|closed|blocked)|"
    r"is (the )?(road|route|pass)\b|"
    r"landslide|open (now|today|currently)|closed (now|today|currently)|"
    r"can we (get|drive|pass) through|"
    r"permits? (are |being )?(open|issued|available) (now|today|currently)|"
    r"permit status|route status|current status"
    r")\b",
    re.IGNORECASE,
)


def refusal_for(question: str) -> Refusal | None:
    """Whether this question must be refused, before any model is involved.

    Order matters. Medical is checked first because a question can be both medical
    and commercial ("can I get a refund, my father has a heart condition") and the
    medical refusal is the one that must win — it routes to a human who will read the
    whole sentence rather than to a policy quote.
    """
    if _MEDICAL.search(question):
        return Refusal.MEDICAL
    if _COMPLAINT.search(question):
        return Refusal.COMPLAINT
    if _COMMERCIAL.search(question):
        return Refusal.COMMERCIAL
    if _PROMISE.search(question):
        return Refusal.PROMISE
    return None


def is_status_question(question: str) -> bool:
    """Asking what is true on the road right now, rather than how something works."""
    if _PROCESS_QUESTION.match(question):
        return False
    return bool(_STATUS_QUESTION.search(question))


#: What a coordinator is told to say instead. Written out rather than generated,
#: because a refusal is exactly the moment not to improvise — and because these are
#: the sentences a traveller remembers.
REFUSAL_GUIDANCE: dict[Refusal, str] = {
    Refusal.MEDICAL: (
        "This needs a person, and ultimately a doctor. We do not assess anybody's"
        " fitness — not by staff judgement and not by machine. Tell them what the"
        " journey actually asks of a body (the altitude profile on the journey page"
        " is the honest version), and ask them to take that to their own doctor."
    ),
    Refusal.COMMERCIAL: (
        "Price, refunds and policy are a human decision with a published policy"
        " behind them. Quote the policy page if it answers them; commit to nothing"
        " that is not already written down."
    ),
    Refusal.PROMISE: (
        "Nobody can promise weather, visibility, darshan or a specific room. Say what"
        " is actually arranged and what depends on the mountain."
    ),
    Refusal.COMPLAINT: (
        "A complaint needs an owner. Take it yourself, and record it — the feedback"
        " flow exists so this reaches somebody rather than being smoothed over."
    ),
    Refusal.STATUS_STALE: (
        "Our last verified record is too old to repeat with confidence. Say when it"
        " was checked and that you will confirm before answering, rather than"
        " passing on something that may have changed."
    ),
    Refusal.NO_GROUNDING: (
        "We have not published anything that answers this. Say so plainly rather than"
        " reasoning from general knowledge — a plausible invented answer about a"
        " permit or a road is how somebody ends up stranded."
    ),
}


@dataclass(frozen=True, slots=True)
class Passage:
    """One retrieved piece of approved content, with the provenance to cite it.

    `source_ref` is what a staff member checks and what an answer quotes. Doc 08
    requires "source or record reference for operational answers"; there is no
    constructor here that omits it, so an unattributable passage cannot enter the
    corpus.
    """

    kind: str
    title: str
    text: str
    source_ref: str
    #: Public path, when the passage corresponds to a page a traveller can read.
    url_path: str | None = None
    last_reviewed_at: datetime | None = None
    score: float = 0.0


@dataclass(frozen=True, slots=True)
class StatusFact:
    """A verified route status, with everything needed to quote it responsibly."""

    segment_name: str
    access: str
    summary: str | None
    verified_at: datetime
    verified_by: str | None
    source: str

    def age(self, *, now: datetime) -> timedelta:
        return now - self.verified_at

    def is_quotable(self, *, now: datetime) -> bool:
        return self.age(now=now) <= STATUS_QUOTABLE_WITHIN

    def as_sentence(self, *, now: datetime) -> str:
        """The claim, with its provenance welded on.

        Built here rather than left to the model, so the timestamp and the verifier
        cannot be dropped in the interest of a smoother sentence.
        """
        hours = int(self.age(now=now).total_seconds() // 3600)
        when = "less than an hour ago" if hours < 1 else f"{hours} hours ago"
        # Name only: this sentence gets pasted into WhatsApp, and the stored
        # attribution carries an email address for internal audit.
        name = public_attribution(self.verified_by)
        who = f" by {name}" if name else ""
        # Whitespace collapsed: a coordinator's note is typed on a phone and carries
        # line breaks, and this sentence is pasted into a chat message as one line.
        note = f" {' '.join(self.summary.split())}" if self.summary else ""
        return (
            f"{self.segment_name} was recorded as"
            f" {self.access.replace('_', ' ')} when it was last verified {when}"
            f"{who}.{note} This is a record of what was checked, not a forecast."
        )


@dataclass(frozen=True, slots=True)
class Grounding:
    """What the assistant is allowed to do with one question."""

    question: str
    passages: tuple[Passage, ...] = ()
    status: StatusFact | None = None
    refusal: Refusal | None = None

    @property
    def may_answer(self) -> bool:
        return self.refusal is None and bool(self.passages or self.status)

    @property
    def citations(self) -> list[str]:
        return [p.source_ref for p in self.passages]


def ground(
    question: str,
    passages: list[Passage],
    *,
    status: StatusFact | None = None,
    now: datetime,
) -> Grounding:
    """Decide what may be answered, before anything is generated.

    Every path through this function is deterministic and testable without a network.
    The model is handed the result; it never gets a vote on it.
    """
    refusal = refusal_for(question)
    if refusal is not None:
        return Grounding(question=question, refusal=refusal)

    if is_status_question(question):
        if status is None:
            return Grounding(question=question, refusal=Refusal.NO_GROUNDING)
        if not status.is_quotable(now=now):
            return Grounding(question=question, refusal=Refusal.STATUS_STALE)
        return Grounding(
            question=question,
            passages=tuple(p for p in passages if p.score >= MIN_RETRIEVAL_SCORE),
            status=status,
        )

    usable = tuple(p for p in passages if p.score >= MIN_RETRIEVAL_SCORE)
    if not usable:
        return Grounding(question=question, refusal=Refusal.NO_GROUNDING)
    return Grounding(question=question, passages=usable)


#: Versioned, because a change to these rules invalidates every evaluation run
#: against the previous version. Doc 08 requires "logging and evaluation"; comparing
#: answers across a silent prompt change would make that evaluation meaningless.
CONTRACT_VERSION = "2026-08-assist-v1"

SYSTEM_CONTRACT = """\
You draft replies for a small Himalayan pilgrimage operator in Pithoragarh. Three
people run it and one of them will read what you write before any traveller sees it.

You are given approved passages from this company's own published content. Answer
ONLY from those passages.

Rules, in order of importance:

1. If the passages do not contain the answer, say so. Never fill a gap from general
   knowledge. A plausible invented answer about a permit, a road or a price is how
   somebody ends up stranded at a checkpost.
2. Cite the source reference given with each passage you use, inline, exactly as
   provided.
3. Never assess anybody's health, fitness or suitability to travel. Not even to
   reassure. That is a doctor's job and this company does not do it.
4. Never commit to a price, a discount, a refund, a specific hotel, a specific
   vehicle, weather, visibility or darshan. Say what is arranged and what depends on
   the mountain.
5. Route and permit status may only be repeated from the verified record supplied to
   you, including when it was checked and who checked it. Never state it as current
   fact without that provenance.
6. No urgency, no scarcity, no social proof. Do not say a departure is filling up.
7. Plain language. Short sentences. No exclamation marks. Write the way somebody who
   has driven that road would write, not the way a brochure does.

If you cannot follow these rules for a question, say what you cannot answer and why,
and hand it to the coordinator.
"""


def build_prompt(grounding: Grounding, *, now: datetime) -> str:
    """The user-side message: the question and the evidence, nothing else.

    No conversation history and no traveller record. Doc 08's guardrails include
    "restricted access to sensitive traveller data", and the simplest way to honour
    that is for the assistant never to receive any.
    """
    lines: list[str] = [f"Question: {grounding.question}", ""]

    if grounding.status is not None:
        lines += [
            "VERIFIED ROUTE STATUS (quote with its timestamp and verifier):",
            grounding.status.as_sentence(now=now),
            "",
        ]

    if grounding.passages:
        lines.append("APPROVED PASSAGES:")
        for passage in grounding.passages:
            reviewed = (
                f", last reviewed {passage.last_reviewed_at:%d %b %Y}"
                if passage.last_reviewed_at
                else ""
            )
            lines += [
                f"[{passage.source_ref}] {passage.title}{reviewed}",
                passage.text.strip(),
                "",
            ]

    return "\n".join(lines).strip()


@dataclass(slots=True)
class Answer:
    """What comes back, with everything a reviewer needs to check it."""

    text: str
    citations: list[str] = field(default_factory=list)
    refusal: Refusal | None = None
    #: Guidance for the coordinator when refused. Never shown to a traveller as-is.
    staff_guidance: str | None = None
    model: str | None = None
    contract_version: str = CONTRACT_VERSION
    #: True when a person must handle this rather than sending a draft.
    needs_human: bool = False


def refusal_answer(refusal: Refusal) -> Answer:
    return Answer(
        text="",
        refusal=refusal,
        staff_guidance=REFUSAL_GUIDANCE[refusal],
        needs_human=True,
    )
