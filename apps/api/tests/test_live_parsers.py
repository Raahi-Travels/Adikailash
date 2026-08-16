"""Parsers for the outside sources, tested on the markup they actually return.

No network. Each fixture is trimmed from a real response captured on 17 Aug 2026,
which is the point: these parse other people's HTML, and the failure mode worth
catching is a silent one where a layout change turns into an empty list that reads
on screen as "nothing to report".
"""

from __future__ import annotations

from datetime import date

from api.live import kmvn, pwd, sachet

PWD_MARKUP = """
<table><tbody>
<tr><td>5</td><td>Pithoragarh Jhulaghat state highway [5520]</td><td>22 , 26</td>
    <td>2026-08-16 15:21</td><td>2026-08-16 18:23</td><td>3 hours 2 mins</td>
    <td>Opened for Traffic</td><td>Divakar Joshi ,Drafsman ,38008904</td><td>0.50</td></tr>
<tr><td>14</td><td>Ogla to Bhagichora Pasma Hanseshwar state highway [10108]</td><td>11</td>
    <td>2026-08-16 13:36</td><td>2026-08-17 00:36</td><td>11 hours 3 mins</td>
    <td>Closed</td><td>Er. Shubham Raja ,URRDA Pithoragarh</td><td>0.20</td></tr>
<tr><td>21</td><td>Tawaghat Sobla motor road [10070]</td><td>4</td>
    <td>2026-08-14 09:00</td><td>2026-08-14 17:00</td><td>8 hours</td>
    <td>Closed</td><td>BRO</td><td>1.10</td></tr>
<tr><td>99</td><td>Rishikesh Badrinath national highway [58]</td><td>7</td>
    <td>2026-08-16 10:00</td><td>2026-08-16 12:00</td><td>2 hours</td>
    <td>Closed</td><td>Someone Else</td><td>0.90</td></tr>
</tbody></table>
"""


def test_only_corridor_roads_are_kept() -> None:
    """A statewide register of two thousand rows must not become two thousand rows."""
    closures = pwd.parse(PWD_MARKUP)
    roads = [c.road for c in closures]

    assert any("Pithoragarh Jhulaghat" in r for r in roads)
    assert any("Tawaghat Sobla" in r for r in roads)
    assert [c.road for c in pwd.parse(PWD_MARKUP) if c.on_corridor]
    # Badrinath is a real closure four districts away. Showing it would teach
    # travellers that our warnings are not about them.
    assert not any("Badrinath" in r for r in roads)


def test_status_text_becomes_a_boolean_the_right_way_round() -> None:
    closures = {c.road.split(" ")[0]: c for c in pwd.parse(PWD_MARKUP)}
    assert not closures["Pithoragarh"].is_closed  # "Opened for Traffic"
    assert closures["Tawaghat"].is_closed


def test_a_district_road_is_kept_but_not_marked_on_corridor() -> None:
    """Filtering on road name alone lost 176 of 197 district rows.

    "Ogla to Bhagichora Pasma Hanseshwar" names nowhere on the journey, and it is
    still a Pithoragarh road a traveller may drive to reach the corridor. It is kept
    and flagged, rather than discarded as a false precision or shown as if it were on
    the route.
    """
    by_road = {c.road.split(" ")[0]: c for c in pwd.parse(PWD_MARKUP)}
    assert "Ogla" in by_road
    assert not by_road["Ogla"].on_corridor
    assert by_road["Tawaghat"].on_corridor


def test_short_rows_are_skipped_rather_than_guessed() -> None:
    assert pwd.parse("<table><tr><td>Gunji</td><td>x</td></tr></table>") == []


def test_a_layout_change_yields_nothing_not_nonsense() -> None:
    assert pwd.parse("<html><body><p>Service unavailable</p></body></html>") == []


def test_the_caveat_names_the_unreported_stretch() -> None:
    """The most important sentence this source produces is about what it lacks."""
    state = pwd.RegisterState(closures=[], checked_at=date.today(), reachable=True)  # type: ignore[arg-type]
    assert pwd.UNREPORTED_ABOVE in state.caveat
    assert "not that the road is open" in state.caveat


SACHET_FEED = """<rss><channel>
<item><title>(2026/08/16 16:06) Light to moderate rain in Almora, Bageshwar, Chamoli and
Pithoragarh districts</title><description>IMD nowcast</description>
<pubDate>Sun, 16 Aug 2026 16:06:00 +0530</pubDate><link>https://sachet.example/1</link></item>
<item><title>Heavy rainfall warning for Haridwar and Dehradun</title>
<description>Orange alert</description><pubDate>Sun, 16 Aug 2026 15:00:00 +0530</pubDate></item>
<item><title>Thunderstorm warning</title>
<description>Severe weather expected over Dharchula tehsil</description>
<pubDate>Sun, 16 Aug 2026 14:00:00 +0530</pubDate></item>
</channel></rss>"""


def test_only_this_district_survives_the_filter() -> None:
    alerts = sachet.parse(SACHET_FEED)
    titles = " ".join(a.title for a in alerts)
    assert "Pithoragarh" in titles
    # Haridwar is 300 km away across a range. A radius filter would have kept it.
    assert "Haridwar" not in titles


def test_a_town_named_in_the_description_still_matches() -> None:
    """Alerts name a tehsil as often as a district; matching titles alone loses them."""
    alerts = sachet.parse(SACHET_FEED)
    assert any("Thunderstorm" in a.title for a in alerts)


def test_severity_is_read_from_the_words_used() -> None:
    alerts = {a.title[:20]: a for a in sachet.parse(SACHET_FEED)}
    assert alerts["Thunderstorm warning"].is_severe


def test_polygon_containment_is_lat_lon_not_lon_lat() -> None:
    """Swapping the pair puts Pithoragarh in the Arabian Sea, silently."""
    box = [(29.0, 80.0), (31.0, 80.0), (31.0, 81.0), (29.0, 81.0)]
    assert sachet.contains(box, 30.2, 80.8)  # Gunji
    assert not sachet.contains(box, 80.8, 30.2)  # the same point, transposed
    assert not sachet.contains(box, 28.0, 80.5)


KMVN_FRAGMENT = """
<div>Date Room Type Meal Plan Total Beds Available Beds Tariff Per Beds (Included GST)
Extra Person GST %</div>
<div>11/09/2026 Sharing accommodation (Per bed ) EP Plan 15 3 &#8377; 1200 NA 5</div>
"""


def test_bed_counts_are_read_off_the_fragment() -> None:
    row = kmvn.parse(
        KMVN_FRAGMENT,
        property_id=56,
        name="Jyolingkong Camp",
        slug="jyolingkong",
        on_date=date(2026, 9, 16),
    )
    assert row is not None
    assert row.total_beds == 15
    assert row.available_beds == 3
    assert row.tariff_inr == 1200


def test_the_requested_date_wins_over_the_printed_one() -> None:
    """The fragment leaks a stale template date; trusting it reports the wrong night."""
    row = kmvn.parse(
        KMVN_FRAGMENT,
        property_id=56,
        name="Jyolingkong Camp",
        slug="jyolingkong",
        on_date=date(2026, 9, 16),
    )
    assert row is not None
    assert row.on_date == date(2026, 9, 16)  # not 11/09/2026 from the markup


def test_scarcity_is_flagged_while_beds_remain() -> None:
    row = kmvn.parse(
        KMVN_FRAGMENT,
        property_id=56,
        name="Jyolingkong Camp",
        slug="jyolingkong",
        on_date=date(2026, 9, 16),
    )
    assert row is not None
    assert row.is_scarce
    assert not row.is_full


def test_impossible_counts_are_discarded_not_published() -> None:
    """Available above total means the columns were misread, not a generous camp."""
    broken = KMVN_FRAGMENT.replace("15 3 &#8377;", "3 15 &#8377;")
    assert (
        kmvn.parse(
            broken,
            property_id=56,
            name="Jyolingkong Camp",
            slug="jyolingkong",
            on_date=date(2026, 9, 16),
        )
        is None
    )


def test_jyolingkong_really_is_that_small() -> None:
    """Fifteen beds is the fact worth publishing; a regression here loses the point."""
    assert any(slug == "jyolingkong" for _, _, slug in kmvn.PROPERTIES)


# ---------------------------------------------------------------------------
# The date bug that only appeared in production
# ---------------------------------------------------------------------------


def test_today_is_the_date_in_india_not_on_the_host() -> None:
    """The refresh wrote zero weather readings in production and passed locally.

    Forecasts are requested with `timezone=Asia/Kolkata`, so their dates are IST
    dates. "Today" was being taken from the host's local date, which is IST on a
    developer's machine in India and UTC inside the container. Between 18:30 and
    24:00 UTC those are different days, so every forecast date failed to match and
    the job silently stored nothing while reporting success.

    Asserted on the boundary rather than on `today()`, so it cannot pass by accident
    depending on when the suite runs.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from api.live.ingest import IST

    # 19:52 UTC on 16 Aug, which is what the failing production run saw.
    moment = datetime(2026, 8, 16, 19, 52, tzinfo=ZoneInfo("UTC"))

    assert moment.astimezone(IST).date() == date(2026, 8, 17)
    assert moment.date() == date(2026, 8, 16)
    # The two genuinely differ at that hour, which is the whole bug.
    assert moment.astimezone(IST).date() != moment.date()


def test_ist_is_the_timezone_forecasts_are_requested_in() -> None:
    """If these two ever drift apart the comparison silently stops matching again."""
    from api.live import open_meteo
    from api.live.ingest import IST

    assert str(IST) == open_meteo.TIMEZONE
