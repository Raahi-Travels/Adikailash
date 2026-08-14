"""What the road has actually done, by week of year (Phase 5, doc 09).

Doc 00 lists "stronger route-status history" under P1 and doc 09 puts "advanced route
intelligence" in Phase 5. This is the useful, honest form of both: for each segment
and each week of the year, what proportion of our own verified observations recorded
it open, limited or closed.

It answers the question a pilgrim planning next season actually asks — *when should I
go?* — and nothing in the system could answer it before. Every departure page, every
guide and every conversation currently says "it depends on the road", which is true
and useless. This says "in the last week of May, across eleven observations over two
seasons, we recorded it open nine times".

**The discipline is refusing to characterise a week we have barely seen.**

A confident "usually open" drawn from one season is worse than silence — somebody
books flights against it. So a week returns `None` for its verdict until it has been
seen enough times *across enough seasons*, and `Pattern.is_reportable` gates the whole
segment. Same rule as the vendor ratings and the attribution confidence flag, for the
same reason: a number on a screen is believed, and the caveat beside it is not.

The two conditions are deliberate — see `MIN_SEASONS`. A raw count aimed at the wrong
failure, and running this against realistic data proved it.

**And this is history, never a forecast.** Weather and landslides do not repeat to a
calendar. The wording throughout is past tense and observational, because the moment
this reads as a prediction it becomes a promise about a road nobody controls — which
doc 03 forbids and the mountain does not care about either way.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime

from api.domain.status import Access

#: Below this many observations in a week, no verdict is offered — only the count.
MIN_OBSERVATIONS = 4

#: And they must span at least this many seasons.
#:
#: Two conditions rather than one raw count, because the count was aiming at the
#: wrong thing. Running this against two realistic seasons of twice-weekly checking
#: produced four observations per week-of-year and a threshold of six silenced every
#: single week — the feature would have shipped saying nothing until a third season.
#:
#: The actual risk was never "too few readings". It is *one unusual year being the
#: whole picture*, and a season count targets that directly: four readings spread
#: across two Mays is a modest but real signal, while eight readings from one May is
#: still one May.
MIN_SEASONS = 2

#: A segment with fewer total observations than this is not summarised at all. A
#: scatter of readings across forty weeks tells you nothing about any of them.
MIN_TOTAL_OBSERVATIONS = 20

#: Proportion of observations that must be open before a week is described as
#: usually open. Deliberately high: "usually open" is what somebody books against.
USUALLY_OPEN_ABOVE = 0.8
#: At or below this, the honest description is that it was usually shut.
USUALLY_BLOCKED_BELOW = 0.4

#: Access values that mean a vehicle is not getting through.
BLOCKING = frozenset({Access.CLOSED, Access.SUSPENDED})


@dataclass(frozen=True, slots=True)
class Observation:
    """One verified status reading, reduced to what history needs."""

    verified_at: datetime
    access: Access

    @property
    def iso_week(self) -> int:
        return self.verified_at.isocalendar().week

    @property
    def year(self) -> int:
        return self.verified_at.isocalendar().year


@dataclass(frozen=True, slots=True)
class Week:
    """What we recorded during one week of the year, across all years seen."""

    iso_week: int
    counts: dict[str, int] = field(default_factory=dict)
    years_observed: tuple[int, ...] = ()

    @property
    def observations(self) -> int:
        return sum(self.counts.values())

    @property
    def open_share(self) -> float | None:
        if self.observations == 0:
            return None
        return self.counts.get(Access.OPEN.value, 0) / self.observations

    @property
    def blocked_share(self) -> float | None:
        if self.observations == 0:
            return None
        blocked = sum(self.counts.get(a.value, 0) for a in BLOCKING)
        return blocked / self.observations

    @property
    def seasons(self) -> int:
        return len(set(self.years_observed))

    @property
    def has_enough(self) -> bool:
        """Enough readings, spread across enough seasons. Both, not either."""
        return self.observations >= MIN_OBSERVATIONS and self.seasons >= MIN_SEASONS

    @property
    def verdict(self) -> str | None:
        """A phrase, or None when we have not seen this week enough times.

        None rather than "unknown" as a string: a caller that forgets to handle it
        renders an empty cell, which is honest, instead of the word "unknown" sitting
        in a column of confident-looking verdicts.
        """
        if not self.has_enough:
            return None
        open_share = self.open_share or 0
        blocked = self.blocked_share or 0
        if open_share >= USUALLY_OPEN_ABOVE:
            return "usually open"
        if blocked >= (1 - USUALLY_BLOCKED_BELOW):
            return "usually shut"
        if open_share <= USUALLY_BLOCKED_BELOW:
            return "more often shut than open"
        return "mixed"

    @property
    def description(self) -> str:
        """Past tense, always. This is a record, not a prediction."""
        if not self.has_enough:
            if self.observations >= MIN_OBSERVATIONS and self.seasons < MIN_SEASONS:
                return (
                    f"{self.observations} observations, but all from"
                    f" {self.seasons} season{'' if self.seasons == 1 else 's'} — one"
                    " unusual year would be the whole picture."
                )
            return (
                f"Only {self.observations} observation"
                f"{'' if self.observations == 1 else 's'} — too few to say anything"
                " about this week."
            )
        years = len(set(self.years_observed))
        span = f"{years} season{'' if years == 1 else 's'}"
        opened = self.counts.get(Access.OPEN.value, 0)
        return (
            f"Recorded open {opened} of {self.observations} times in this week of"
            f" the year, across {span}."
        )


@dataclass(slots=True)
class Pattern:
    """One segment's history, week by week."""

    segment_slug: str
    segment_name: str
    weeks: list[Week] = field(default_factory=list)
    total_observations: int = 0
    first_observed: date | None = None
    last_observed: date | None = None

    @property
    def is_reportable(self) -> bool:
        """Whether this segment has been watched long enough to summarise at all."""
        return self.total_observations >= MIN_TOTAL_OBSERVATIONS

    @property
    def seasons_observed(self) -> int:
        if not (self.first_observed and self.last_observed):
            return 0
        return self.last_observed.year - self.first_observed.year + 1

    @property
    def best_weeks(self) -> list[Week]:
        """Weeks recorded open most often, among those seen enough times.

        Sorted by open share, then by how many times we have seen the week — so a
        week seen twenty times ranks above an equally good week seen six times.
        """
        eligible = [w for w in self.weeks if w.has_enough]
        return sorted(
            eligible,
            key=lambda w: (-(w.open_share or 0), -w.observations),
        )

    @property
    def caveats(self) -> list[str]:
        """What a reader must know before planning against this.

        Text, not flags, so the warning survives a screenshot — same reason as the
        vendor and attribution reports.
        """
        notes = [
            "This is what our coordinators recorded, not a forecast. Weather and"
            " landslides do not repeat to a calendar."
        ]
        if not self.is_reportable:
            notes.append(
                f"Only {self.total_observations} observations so far, across"
                f" {self.seasons_observed} season(s). We are not drawing a pattern"
                " from that."
            )
        thin = [w for w in self.weeks if w.observations and not w.has_enough]
        if thin:
            notes.append(
                f"{len(thin)} week(s) carry no verdict — they need at least"
                f" {MIN_OBSERVATIONS} observations across {MIN_SEASONS} seasons."
            )
        if self.seasons_observed < 2:
            notes.append(
                "Less than two seasons of history. One unusual year is the whole"
                " picture at this point."
            )
        return notes


def build_pattern(
    segment_slug: str, segment_name: str, observations: list[Observation]
) -> Pattern:
    """Group verified readings into weeks of the year.

    ISO week rather than calendar month: the road opens and shuts on a scale of days,
    and "May" spans the difference between shut and open on this route entirely.
    """
    by_week: dict[int, Counter] = {}
    years: dict[int, set[int]] = {}

    for observation in observations:
        week = observation.iso_week
        by_week.setdefault(week, Counter())[observation.access.value] += 1
        years.setdefault(week, set()).add(observation.year)

    weeks = [
        Week(
            iso_week=week,
            counts=dict(counts),
            years_observed=tuple(sorted(years.get(week, set()))),
        )
        for week, counts in sorted(by_week.items())
    ]

    dates = [o.verified_at.date() for o in observations]
    return Pattern(
        segment_slug=segment_slug,
        segment_name=segment_name,
        weeks=weeks,
        total_observations=len(observations),
        first_observed=min(dates) if dates else None,
        last_observed=max(dates) if dates else None,
    )


def week_starting(iso_week: int, year: int) -> date:
    """The Monday of an ISO week, so a week number can be shown as a date range.

    "Week 21" means nothing to a traveller choosing dates; "19-25 May" does.
    """
    return date.fromisocalendar(year, iso_week, 1)
