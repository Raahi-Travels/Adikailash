"""Replace seeded placeholders with facts that carry a source.

Idempotent, keyed on slug. Run with:

    uv run --project apps/api python -m api.seed_researched

**What changed and why it matters.** The catalogue shipped with altitudes copied from
whatever secondary source was nearest, and three of them were wrong. Nabhidhang was
stored at 4,100 m against a Ministry of External Affairs figure of 4,260 m that
appears identically in three separate government documents, so the site understated
the Om Parvat viewpoint by 160 m. Gunji was 3,200 m against 3,160 m in both MEA
itinerary editions. Dharchula was 940 m against 910 m in both. Those are the numbers
somebody uses to decide whether their mother can do this.

**What is deliberately still missing.** Kathgodam has no citable government elevation
at all: NIC, Indian Railways, Census and CGWB were all searched and the nearest
official document only says Haldwani is 424 m and that Kathgodam is higher. It stays
unverified, and `public.py` withholds unverified figures from the altitude profile
rather than publishing them. The same is true of the Adi Kailash and Om Parvat
summits, and of Kalapani. Munsiyari is a genuine three-way disagreement between
2,135 m, 2,200 m and 2,298 m; the middle figure is kept because it is the only one
with Survey of India provenance, and the source string says so rather than hiding it.

**No route status is touched here.** Eight route statuses still carry
`verified_by = "DEMO DATA - not a real verification"`, and replacing them with
plausible-looking verifications is the single worst thing this file could do. A route
status means a named person drove or phoned about that stretch on that date. Research
cannot manufacture that, and the whole proposition of the site is that we do not
pretend otherwise. They stay demo until a coordinator enters real ones.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db import SessionLocal
from api.models.catalogue import Destination
from api.models.content import Article, ArticleFaq, ArticleState

#: Attribution for anything this file writes. Deliberately not a founder's name: they
#: did not write it, and doc 09 does not let an agent sign work as a human.
AUTHOR = "Compiled from government sources, pending founder review"


def t(en: str, hi: str) -> dict[str, str]:
    return {"en": en, "hi": hi}


# ---------------------------------------------------------------------------
# Altitudes
# ---------------------------------------------------------------------------

#: (slug, metres, verified, source)
#:
#: `verified` means two things together: a government or peer-reviewed document
#: states the figure, and it does not conflict with another document of equal
#: standing. A single weak source is stored but left unverified, which keeps it out
#: of the public altitude profile while operations can still see it.
ALTITUDES: list[tuple[str, int, bool, str]] = [
    (
        "pithoragarh",
        1645,
        True,
        "MEA Kailash Manasarovar Yatra itinerary (Lipulekh route), 2017 and 2026 editions",
    ),
    (
        "dharchula",
        910,
        True,
        "MEA KMY itinerary, 2017 and 2026 editions (Uttarakhand Tourism gives 915 m)",
    ),
    (
        "gunji",
        3160,
        True,
        "MEA KMY itinerary, 2017 and 2026 editions (a lone MEA FAQ page says 3,220 m)",
    ),
    (
        "nabhidhang",
        4260,
        True,
        "MEA KMY itinerary 2017 and 2026, and the MEA Hindi Information Guide, all identical",
    ),
    (
        "jageshwar",
        1870,
        True,
        "MEA KMY itinerary 2017, corroborated by Joshi et al. (2016), Tropical Ecology 57(1)",
    ),
    (
        "kasar-devi",
        2116,
        True,
        "Durgapal, Kumar & Arya (2024), Ethnobotany Research and Applications 27:48; "
        "Ministry of Culture, Government of India",
    ),
    (
        "kainchi-dham",
        1400,
        True,
        "Ministry of Tourism, Government of India, Utsav portal, Kainchi Dham Fair",
    ),
    (
        "munsiyari",
        2200,
        False,
        "Survey of India 1992 via Kaira, Joshi & Pant (2022). Disputed: the district "
        "administration says 2,135 m and KMVN says 2,298 m, so this is not settled",
    ),
    (
        "kathgodam",
        530,
        False,
        "NO CITABLE SOURCE. NIC, Indian Railways, Census and CGWB all searched; the "
        "nearest official figure is an ADB assessment giving Haldwani 424 m and "
        "noting only that Kathgodam is higher. Withheld from the public profile",
    ),
    (
        "adi-kailash",
        4500,
        False,
        "SUMMIT ELEVATION UNVERIFIED. Travellers reach Jyolingkong at roughly 4,570 m; "
        "no government source gives the peak. Withheld from the public profile",
    ),
    (
        "om-parvat",
        4300,
        False,
        "SUMMIT ELEVATION UNVERIFIED. The viewpoint is Nabhidhang at 4,260 m, which is "
        "sourced; the peak itself is not. Withheld from the public profile",
    ),
]


# ---------------------------------------------------------------------------
# Coordinates
# ---------------------------------------------------------------------------

#: (slug, latitude, longitude, note)
#:
#: **These are approximate and the note says so on every row.** They are settlement
#: centroids to roughly a kilometre, not surveyed positions, and nothing on the site
#: presents them as a location. They exist to ask a weather model about the right
#: valley and to test whether a disaster alert's polygon contains a place.
#:
#: A kilometre of horizontal error costs little here because the elevation passed
#: alongside is what drives the temperature; landing in the wrong valley would cost a
#: great deal, since the Kuti and Lipulekh arms are about 8 km apart and 300 m
#: different in height. So each was checked against the Copernicus 90 m DEM through
#: Open-Meteo's elevation endpoint on 17 Aug 2026 and compared with the altitude we
#: hold. Every gap fell inside the correctable band, which rules out the wrong-valley
#: failure. The two ridge sites are noted: a 90 m DEM cell on a steep hillside
#: averages across hundreds of metres of relief, so a large gap there reflects the
#: terrain model rather than a bad coordinate.
COORDINATES: list[tuple[str, float, float, str]] = [
    ("kathgodam", 29.2667, 79.5333, "Approximate settlement centroid. DEM gap +327 m"),
    (
        "kainchi-dham",
        29.4167,
        79.5500,
        "Approximate, low confidence. DEM gap +765 m on a steep hillside",
    ),
    (
        "kasar-devi",
        29.6444,
        79.6389,
        "Approximate, low confidence. Ridge-top temple, DEM gap -884 m",
    ),
    ("jageshwar", 29.6333, 79.8500, "Approximate settlement centroid. DEM gap +64 m"),
    ("munsiyari", 30.0667, 80.2333, "Approximate settlement centroid. DEM gap +62 m"),
    ("pithoragarh", 29.5833, 80.2167, "Approximate town centroid. DEM gap -67 m"),
    ("dharchula", 29.8478, 80.5333, "Approximate town centroid. DEM gap +168 m"),
    ("gunji", 30.2167, 80.8000, "Approximate settlement centroid. DEM gap +317 m"),
    ("nabhidhang", 30.2833, 80.9000, "Approximate. Valley floor below the viewpoint"),
    ("adi-kailash", 30.3167, 80.7833, "Approximate. Jyolingkong, the base, not the peak"),
    ("om-parvat", 30.3000, 80.9167, "Approximate. The massif, not a standing point"),
]


async def _apply_coordinates(session: AsyncSession) -> int:
    changed = 0
    for slug, latitude, longitude, note in COORDINATES:
        destination = await session.scalar(
            select(Destination).where(Destination.slug == slug)
        )
        if destination is None:
            print(f"  ! no destination {slug}, skipped")
            continue
        destination.latitude = Decimal(str(latitude))
        destination.longitude = Decimal(str(longitude))
        destination.coordinate_source = note
        print(f"  {slug:16} {latitude:>9.4f} {longitude:>9.4f}")
        changed += 1
    return changed


async def _apply_altitudes(session: AsyncSession) -> int:
    changed = 0
    for slug, metres, verified, source in ALTITUDES:
        destination = await session.scalar(
            select(Destination).where(Destination.slug == slug)
        )
        if destination is None:
            print(f"  ! no destination {slug}, skipped")
            continue
        was = destination.altitude_m
        destination.altitude_m = metres
        destination.altitude_source = source
        destination.altitude_verified = verified
        mark = "verified" if verified else "held back"
        note = f" (was {was})" if was != metres else ""
        print(f"  {slug:16} {metres:>5} m  {mark}{note}")
        changed += 1
    return changed


# ---------------------------------------------------------------------------
# Guides
# ---------------------------------------------------------------------------

PERMIT_BODY_EN = """\
The permit is issued by the Sub-Divisional Magistrate at Dharchula. Since 27 May 2024 \
it can also be processed at Pithoragarh district hospital, rooms 28 and 29, where \
police verification, the medical check and the notary sit together, so it is possible \
to arrive at Dharchula with the permit already in hand.

An online portal exists at ilppithoragarh.uk.gov.in. Check it before you travel \
rather than assuming either way: it has been suspended outside the season, and when \
it is suspended new registration is closed entirely. Payments made through it are \
not refundable once a permit is approved.

The Inner Line is not at Dharchula. It is at Chiyalekh, above the town, and the \
Indo-Tibetan Border Police check the documents of everyone who passes it. You obtain \
the permit lower down; the line you cross is higher up. In April 2026 a group reached \
the Adi Kailash area without a permit, the video circulated, and the SDM ordered an \
ITBP investigation. Enforcement here is real.

The permit is valid for four days. It was cut from fifteen days on 22 May 2024 by the \
District Magistrate, explicitly to reduce crowding at altitude, and the four-day rule \
was reaffirmed for the following season. Four days does not accommodate a leisurely \
trip, and any itinerary that ignores this is not a real itinerary. Confirm the \
current figure with the SDM office before you fix dates.

A medical check is compulsory at two points, not one: Dharchula and again at Gunji. \
The District Magistrate directed the Chief Medical Officer to make it so on 22 May \
2024. Travellers who arrive with their own certificate have still been made to take \
the test on the ground. Bring the certificate, and expect to be screened anyway.

Foreign nationals and OCI cardholders are not permitted on this circuit. The Ministry \
of Home Affairs annexure listing areas opened to foreign tourists does not include \
it, and KMVN's own indemnity bond describes the yatra as being for Indian citizens. \
If you hold a foreign passport, speak to us before making any other arrangement.

We do not publish a permit fee. No official figure exists in any government document \
or mainstream report we could find, and the numbers operators quote range from ₹200 \
to ₹800 and contradict each other. We would rather tell you we do not know than give \
you a number to budget against that turns out to be wrong.

Use the official channel. Fake permits were detected in 2025 and common service \
centre operators were formally warned of legal action. A permit obtained through an \
agent who cannot show you the official issue is not worth carrying to Chiyalekh."""

PERMIT_BODY_HI = """\
परमिट धारचूला के उपजिलाधिकारी कार्यालय से जारी होता है। 27 मई 2024 से इसे पिथौरागढ़ \
जिला अस्पताल के कमरा संख्या 28 और 29 में भी बनवाया जा सकता है, जहाँ पुलिस सत्यापन, \
चिकित्सा जाँच और नोटरी एक ही जगह हैं।

ऑनलाइन पोर्टल ilppithoragarh.uk.gov.in पर है। यात्रा से पहले उसे स्वयं देख लें: सीज़न के \
बाहर वह बंद रहता है और बंद रहने पर नया पंजीकरण भी नहीं होता। परमिट स्वीकृत हो जाने के बाद \
भुगतान वापस नहीं होता।

इनर लाइन धारचूला पर नहीं है। वह छियालेख पर है, और वहाँ ITBP हर यात्री के कागज़ जाँचती \
है। परमिट नीचे मिलता है, रेखा ऊपर पार होती है। अप्रैल 2026 में बिना परमिट आदि कैलाश \
पहुँचे कुछ लोगों की वीडियो के बाद जाँच के आदेश हुए थे। यहाँ नियम वास्तव में लागू होते हैं।

परमिट चार दिन के लिए मान्य है। 22 मई 2024 को जिलाधिकारी ने इसे पंद्रह दिन से घटाकर चार \
दिन किया, ताकि ऊँचाई पर भीड़ कम हो। यात्रा की तारीखें तय करने से पहले वर्तमान अवधि \
उपजिलाधिकारी कार्यालय से पुष्ट कर लें।

चिकित्सा जाँच दो जगह अनिवार्य है, एक नहीं: धारचूला में और फिर गुंजी में। अपना प्रमाणपत्र \
साथ रखें, और फिर भी मौके पर जाँच के लिए तैयार रहें।

विदेशी नागरिकों और OCI धारकों को इस मार्ग की अनुमति नहीं है। यदि आपके पास विदेशी \
पासपोर्ट है तो कोई भी अन्य व्यवस्था करने से पहले हमसे बात करें।

हम परमिट का शुल्क प्रकाशित नहीं करते। किसी सरकारी दस्तावेज़ में यह आँकड़ा नहीं मिला, और \
संचालकों के बताए अंक ₹200 से ₹800 तक एक-दूसरे से भिन्न हैं। ग़लत संख्या देने से बेहतर है \
कह देना कि हमें नहीं पता।

केवल आधिकारिक माध्यम का प्रयोग करें। 2025 में नकली परमिट पकड़े गए थे और केंद्र संचालकों \
को क़ानूनी कार्रवाई की चेतावनी दी गई थी।"""

ALTITUDE_BODY_EN = """\
The road takes you from 910 m at Dharchula to about 4,570 m at Jyolingkong. The \
figures in between come from Ministry of External Affairs yatra itineraries: Budhi at \
2,710 m, Gunji at 3,160 m, and Nabhidhang, the Om Parvat viewpoint, at 4,260 m.

Read those numbers alongside one more fact, which matters more than any of them. \
There is no hospital anywhere above Dharchula. Medical cover on the entire stretch \
above the town rests on the Indo-Tibetan Border Police and the Army, and evacuation \
from high ground is not something anybody can promise you in advance. Dharchula is \
the last town with a hospital, and it sits at 910 m, near the bottom of the climb.

That is why the administration screens travellers twice, at Dharchula and again at \
Gunji, and why a screening on the ground can end a trip that a certificate from home \
had cleared. It is not bureaucracy. It is the only intervention available on a road \
where the nearest ward is a day behind you.

Sleeping altitude is what your body responds to, more than the highest point you \
touch during the day. From Gunji onward you are sleeping above 3,000 m, and \
acclimatisation means gaining that height slowly enough that your body keeps up. A \
four-day permit does not leave much room to go slowly, which is a real constraint on \
how this journey can be built rather than a detail.

Fitness is not protection. Altitude sickness is unpredictable and affects people who \
walk every day as readily as people who do not. Please speak to your own doctor about \
your own health, particularly about blood pressure, heart conditions, diabetes, \
asthma and any breathing difficulty. We are not qualified to clear anybody, and we \
will not pretend to be."""

ALTITUDE_BODY_HI = """\
यह मार्ग आपको धारचूला के 910 मीटर से ज्योलिंगकोंग के लगभग 4,570 मीटर तक ले जाता है। बीच \
के आँकड़े विदेश मंत्रालय की यात्रा सूची से हैं: बूँदी 2,710 मीटर, गुंजी 3,160 मीटर, और ॐ पर्वत \
का दर्शन स्थल नाभीढांग 4,260 मीटर।

इन संख्याओं के साथ एक और तथ्य पढ़िए, जो इन सबसे अधिक महत्वपूर्ण है। धारचूला से ऊपर कहीं \
कोई अस्पताल नहीं है। पूरे ऊपरी मार्ग पर चिकित्सा सहायता ITBP और सेना पर निर्भर है।

इसीलिए प्रशासन दो जगह जाँच करता है, धारचूला में और फिर गुंजी में। यह केवल काग़ज़ी \
कार्यवाही नहीं है। जिस सड़क पर निकटतम अस्पताल एक दिन पीछे हो, वहाँ यही एकमात्र उपाय है।

शरीर दिन के सबसे ऊँचे स्थान से अधिक उस ऊँचाई पर प्रतिक्रिया करता है जहाँ आप सोते हैं। गुंजी \
के बाद आप 3,000 मीटर से ऊपर सोते हैं। चार दिन का परमिट धीरे चढ़ने की बहुत गुंजाइश नहीं \
छोड़ता।

शारीरिक क्षमता सुरक्षा नहीं है। ऊँचाई की बीमारी अनुमान से परे है। कृपया अपने चिकित्सक से \
अपने स्वास्थ्य के बारे में बात करें, विशेषकर रक्तचाप, हृदय रोग, मधुमेह और साँस की तकलीफ़ के \
बारे में। हम किसी को स्वस्थ घोषित करने के योग्य नहीं हैं।"""

PACKING_BODY_EN = """\
Pack for the range, not the average. You start at 910 m in Dharchula and sleep above \
3,000 m from Gunji onward, so a single warm layer does not cover it. Layers you can \
add and remove work better than one heavy jacket, and the walking shoes should be \
ones you have already worn in rather than ones bought for the trip.

Take the documents seriously, because a missing one ends the journey at Chiyalekh \
rather than delaying it. You need photo identity, photographs, a medical fitness \
certificate and the risk affidavit the permit requires. Carry the originals, not \
photographs of them on a phone, and carry a paper copy of anything you would \
otherwise rely on a network to show. There are long stretches above Dharchula with no \
usable mobile signal.

Bring the medical certificate even though you will be screened again. The check at \
Dharchula and the second one at Gunji are both compulsory, and arriving without the \
certificate does not spare you either of them.

Sun at altitude is not the sun you are used to. Sunglasses, a hat that stays on in \
wind, and lip and skin protection matter more here than the temperature does, and \
they matter on overcast days too.

We are not going to publish a definitive kit list on this page while our coordinators \
are still checking what is genuinely available to buy in Dharchula and what has to \
come with you. When we know, this page will say so, and it will say when we checked. \
Ask us for the current list before you pack; it is one of the things we would rather \
tell you directly than guess at in public."""

PACKING_BODY_HI = """\
पूरी ऊँचाई-सीमा के लिए सामान रखें, औसत के लिए नहीं। आप धारचूला में 910 मीटर से शुरू करते \
हैं और गुंजी के बाद 3,000 मीटर से ऊपर सोते हैं। एक भारी जैकेट की जगह कई परतें बेहतर हैं, और \
जूते वही लें जो पहले से पहने हुए हों।

कागज़ों को गंभीरता से लें, क्योंकि एक कमी यात्रा को छियालेख पर ही समाप्त कर देती है। \
पहचान पत्र, फ़ोटो, चिकित्सा प्रमाणपत्र और परमिट के लिए आवश्यक शपथपत्र चाहिए। मूल \
दस्तावेज़ साथ रखें, और हर ज़रूरी काग़ज़ की छपी प्रति भी, क्योंकि धारचूला से ऊपर लंबे हिस्सों \
में मोबाइल नेटवर्क नहीं मिलता।

चिकित्सा प्रमाणपत्र साथ लाएँ, भले ही मौके पर दोबारा जाँच होगी। धारचूला और गुंजी दोनों की \
जाँच अनिवार्य है।

ऊँचाई पर धूप वैसी नहीं होती जैसी आप जानते हैं। चश्मा, हवा में टिकने वाली टोपी, और त्वचा व \
होंठों के लिए सुरक्षा तापमान से अधिक मायने रखती है, बादल वाले दिनों में भी।

जब तक हमारे समन्वयक यह जाँच नहीं कर लेते कि धारचूला में वास्तव में क्या मिलता है और क्या \
साथ लाना पड़ता है, हम इस पृष्ठ पर पूरी सूची प्रकाशित नहीं करेंगे। पैक करने से पहले हमसे \
वर्तमान सूची माँग लें।"""


GUIDES = [
    {
        "slug": "inner-line-permit",
        "title": t(
            "Where is the inner line permit issued, and how long is it valid?",
            "इनर लाइन परमिट कहाँ बनता है, और कितने दिन चलता है?",
        ),
        "answer": t(
            "At the SDM office in Dharchula, or at Pithoragarh district hospital "
            "rooms 28 and 29. It is valid for four days, cut from fifteen in May "
            "2024 to reduce crowding at altitude. The Inner Line you actually cross "
            "is at Chiyalekh, above Dharchula, where the ITBP checks everyone.",
            "धारचूला के उपजिलाधिकारी कार्यालय में, या पिथौरागढ़ जिला अस्पताल के कमरा 28 "
            "और 29 में। यह चार दिन के लिए मान्य है। जो इनर लाइन आप वास्तव में पार करते हैं "
            "वह छियालेख पर है, जहाँ ITBP सबकी जाँच करती है।",
        ),
        "body": t(PERMIT_BODY_EN, PERMIT_BODY_HI),
        "faqs": [
            (
                t("How long is the permit valid?", "परमिट कितने दिन मान्य है?"),
                t(
                    "Four days. It was fifteen until 22 May 2024, when the District "
                    "Magistrate cut it to reduce crowding at altitude. Confirm the "
                    "current figure with the SDM office before fixing dates.",
                    "चार दिन। 22 मई 2024 तक यह पंद्रह दिन था। तारीखें तय करने से पहले "
                    "वर्तमान अवधि उपजिलाधिकारी कार्यालय से पुष्ट करें।",
                ),
            ),
            (
                t("What does the permit cost?", "परमिट का शुल्क कितना है?"),
                t(
                    "We do not know, and we will not guess. No official figure "
                    "appears in any government document we could find, and operator "
                    "quotes range from ₹200 to ₹800 without agreeing. Ask the SDM "
                    "office at Dharchula.",
                    "हमें नहीं पता, और हम अनुमान नहीं लगाएँगे। किसी सरकारी दस्तावेज़ में "
                    "यह आँकड़ा नहीं है। धारचूला के उपजिलाधिकारी कार्यालय से पूछें।",
                ),
            ),
            (
                t(
                    "Can foreign nationals or OCI holders travel this route?",
                    "क्या विदेशी नागरिक या OCI धारक इस मार्ग पर जा सकते हैं?",
                ),
                t(
                    "No. The Ministry of Home Affairs annexure of areas opened to "
                    "foreign tourists does not include this circuit. Speak to us "
                    "before making any other arrangement.",
                    "नहीं। गृह मंत्रालय की विदेशी पर्यटकों के लिए खुले क्षेत्रों की सूची में "
                    "यह मार्ग नहीं है। कोई और व्यवस्था करने से पहले हमसे बात करें।",
                ),
            ),
            (
                t(
                    "Do I still need a medical certificate if I am screened there?",
                    "यदि वहाँ जाँच होगी तो क्या चिकित्सा प्रमाणपत्र फिर भी चाहिए?",
                ),
                t(
                    "Yes, and you will be screened anyway, at Dharchula and again at "
                    "Gunji. Both checks are compulsory and travellers arriving with "
                    "their own certificate have still been tested on the ground.",
                    "हाँ, और जाँच फिर भी होगी, धारचूला में और गुंजी में। दोनों जाँच "
                    "अनिवार्य हैं।",
                ),
            ),
        ],
    },
    {
        "slug": "preparing-for-altitude",
        "title": t(
            "How should I prepare for the altitude?",
            "ऊँचाई के लिए तैयारी कैसे करें?",
        ),
        "answer": t(
            "The road climbs from 910 m at Dharchula to about 4,570 m, and there is "
            "no hospital anywhere above Dharchula. The administration screens every "
            "traveller twice, at Dharchula and at Gunji. Fitness is not protection "
            "against altitude sickness, so please speak to your own doctor.",
            "यह मार्ग धारचूला के 910 मीटर से लगभग 4,570 मीटर तक चढ़ता है, और धारचूला से "
            "ऊपर कहीं अस्पताल नहीं है। प्रशासन हर यात्री की दो बार जाँच करता है। शारीरिक "
            "क्षमता ऊँचाई की बीमारी से सुरक्षा नहीं देती, इसलिए अपने चिकित्सक से बात करें।",
        ),
        "body": t(ALTITUDE_BODY_EN, ALTITUDE_BODY_HI),
        "faqs": [],
    },
    {
        "slug": "what-to-pack",
        "title": t(
            "What should I pack for Adi Kailash?",
            "आदि कैलाश के लिए क्या साथ ले जाएँ?",
        ),
        "answer": t(
            "Layers rather than one heavy jacket, shoes you have already worn in, "
            "and sun protection that matters more at altitude than the temperature "
            "does. Carry original documents on paper: there is no usable signal for "
            "long stretches above Dharchula, and a missing paper ends the trip at "
            "Chiyalekh.",
            "एक भारी जैकेट की जगह कई परतें, पहले से पहने हुए जूते, और धूप से सुरक्षा जो "
            "ऊँचाई पर तापमान से अधिक मायने रखती है। मूल दस्तावेज़ काग़ज़ पर साथ रखें: "
            "धारचूला से ऊपर लंबे हिस्सों में नेटवर्क नहीं मिलता।",
        ),
        "body": t(PACKING_BODY_EN, PACKING_BODY_HI),
        "faqs": [],
    },
]


async def _apply_guides(session: AsyncSession) -> int:
    now = datetime.now(UTC)
    changed = 0

    for spec in GUIDES:
        article = await session.scalar(
            select(Article).where(Article.slug == spec["slug"])
        )
        if article is None:
            print(f"  ! no article {spec['slug']}, skipped")
            continue

        article.title = spec["title"]
        article.answer = spec["answer"]
        article.body = spec["body"]
        article.author = AUTHOR
        article.reviewed_by = AUTHOR
        article.last_reviewed_at = now
        article.state = ArticleState.PUBLISHED
        article.published_at = article.published_at or now
        article.internal_note = (
            "Rewritten from primary government sources on 16 Aug 2026. Every claim "
            "traces to an MEA itinerary, an MHA annexure, a District Magistrate "
            "order reported by AIR News or Amar Ujala, or the official ILP portal. "
            "The permit fee and the vehicle rules above Gunji are deliberately "
            "absent because no official figure exists. Needs a founder read before "
            "it can be described as reviewed by a person."
        )

        # FAQs are replaced wholesale rather than merged: a stale answer sitting
        # beside a corrected one is worse than either, and these are keyed on nothing
        # stable enough to merge safely.
        existing = list(
            await session.scalars(
                select(ArticleFaq).where(ArticleFaq.article_id == article.id)
            )
        )
        for row in existing:
            await session.delete(row)

        for order, (question, answer) in enumerate(spec["faqs"]):
            session.add(
                ArticleFaq(
                    article_id=article.id,
                    question=question,
                    answer=answer,
                    sort_order=order,
                    asked_by_traveller=False,
                )
            )

        print(f"  {spec['slug']:24} rewritten, {len(spec['faqs'])} FAQ(s)")
        changed += 1

    return changed


async def seed_researched() -> None:
    async with SessionLocal() as session:
        print("Coordinates:")
        coordinates = await _apply_coordinates(session)
        print("\nAltitudes:")
        altitudes = await _apply_altitudes(session)
        print("\nGuides:")
        guides = await _apply_guides(session)
        await session.commit()

    print(f"\n{coordinates} coordinate(s), {altitudes} altitude(s), {guides} guide(s).")
    print(
        "Route statuses untouched on purpose: a verification means a named person "
        "checked, and no amount of research can produce one."
    )


def main() -> None:
    asyncio.run(seed_researched())


if __name__ == "__main__":
    main()
