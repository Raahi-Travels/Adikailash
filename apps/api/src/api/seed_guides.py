"""Guides for the findings that had nowhere to live.

Run with:

    uv run --project apps/api python -m api.seed_guides

Separate from `seed_researched` because that one corrects rows that already existed
and this one creates rows that did not. Both are idempotent on slug.

Four pieces, each answering a question the research showed we were either silent on
or wrong about.

**"Is the road motorable" is the commercially important one**, and it is the one most
of the internet still gets wrong. The Ministry of External Affairs stated on 21 May
2026 that "both routes are now fully motorable, and involve very little trekking",
and a Rajya Sabha answer on 2 April 2026 says road connectivity was established to
move yatris to Lipulekh in vehicles. The MEA's own FAQ page still says there is "a
trekking of about 200 km" and that it takes 23 to 25 days, which was true of the 2017
itinerary and is not true now. A sixty-five-year-old reading that page decides they
cannot go. The 2017 itinerary had five consecutive trekking days between Dharchula
and Gunji; the 2026 one has Dharchula to Gunji by jeep.

**The Kailash Mansarovar distinction prevents a mis-sale.** They are different
products with a similar name, and the differences are the kind that end a trip: a
hard age cap of 70, a BMI limit, a Chinese visa, twenty-two days, roughly two lakh
rupees, and a consent form for cremation on the Chinese side. Our journey has none of
those. Somebody who books us thinking they have booked that, or the reverse, has a
serious problem, so the site says which is which.

**The costs piece exists because we cannot answer the obvious question.** There is no
official permit fee anywhere, and operator quotes range from two hundred to eight
hundred rupees. Rather than pick one, the guide says so, and covers the cost we *can*
state: the green cess, which is real, statewide since December 2025, and collected
automatically at the state border from every out-of-state vehicle.

**The hazards piece is mostly about absence.** No GLOF early warning system exists
here. There is an inventory of six moraine-dammed lakes in the Kali headwaters, four
of them Risk Class A, and nothing watching them. Publishing that is uncomfortable and
is the honest thing to do, because the alternative is a reader assuming somebody is.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db import SessionLocal
from api.models.content import Article, ArticleCluster, ArticleFaq, ArticleState

AUTHOR = "Compiled from government sources, pending founder review"

NOTE = (
    "Written from primary government sources on 17 Aug 2026: MEA press releases and "
    "Kailash Manasarovar Yatra itineraries, a Rajya Sabha answer, the MHA annexure, "
    "kmy.gov.in eligibility and advisory pages, and the Uttarakhand green cess "
    "notification. Needs a founder read before it can be described as reviewed by a "
    "person."
)


def t(en: str, hi: str) -> dict[str, str]:
    return {"en": en, "hi": hi}


MOTORABLE_EN = """\
For years this journey meant walking. The Ministry of External Affairs itinerary for \
2017 has five consecutive trekking days between Dharchula and Gunji, by way of \
Sirkha, Gala and Budhi. Most of what is written about this route online still \
describes that trip.

It is no longer that trip. The 2026 itinerary covers Dharchula to Gunji as seventy \
kilometres by jeep, and Gunji to Nabhidhang as eighteen kilometres by jeep. In May \
2026 the Ministry stated plainly that both routes are now fully motorable and involve \
very little trekking, and a Rajya Sabha answer in April 2026 confirmed that road \
connectivity has been established to move pilgrims to the Lipulekh area in vehicles.

This is the single most useful thing we can tell somebody deciding whether a parent \
can come. The walking that remains is short and specific, not five days of it.

Be careful what you read. The Ministry's own frequently-asked-questions page still \
says the route involves about two hundred kilometres of trekking and takes twenty \
three to twenty five days. That was accurate before the road, and the same \
Ministry's 2026 itinerary and its own May 2026 statement now contradict it. If \
somebody quotes those numbers at you, they are quoting a page nobody has updated.

What being motorable does not change: the altitude, which is the actual difficulty, \
and the fact that there is no hospital anywhere above Dharchula. A jeep gets you to \
four thousand metres faster than your body would prefer. Read the altitude guide \
alongside this one."""

MOTORABLE_HI = """\
वर्षों तक इस यात्रा का अर्थ पैदल चलना था। विदेश मंत्रालय की 2017 की सूची में धारचूला से \
गुंजी के बीच लगातार पाँच दिन की पैदल यात्रा है। इंटरनेट पर इस मार्ग के बारे में जो लिखा है, \
वह अधिकतर उसी यात्रा का वर्णन है।

अब वह यात्रा नहीं रही। 2026 की सूची में धारचूला से गुंजी सत्तर किलोमीटर जीप से है, और गुंजी \
से नाभीढांग अठारह किलोमीटर जीप से। मई 2026 में मंत्रालय ने स्पष्ट कहा कि दोनों मार्ग अब \
पूरी तरह मोटर योग्य हैं और उनमें बहुत कम पैदल चलना है।

यह वह बात है जो किसी को अपने माता-पिता के आने का निर्णय लेने में सबसे अधिक काम आती है।

पढ़ते समय सावधान रहें। मंत्रालय के अपने प्रश्नोत्तर पृष्ठ पर आज भी लिखा है कि मार्ग में लगभग \
दो सौ किलोमीटर पैदल चलना है और इसमें तेईस से पच्चीस दिन लगते हैं। सड़क बनने से पहले यह \
सही था। उसी मंत्रालय की 2026 की सूची इसका खंडन करती है।

मोटर मार्ग होने से जो नहीं बदलता: ऊँचाई, जो असली कठिनाई है, और यह तथ्य कि धारचूला से \
ऊपर कहीं अस्पताल नहीं है। जीप आपको चार हज़ार मीटर तक उससे तेज़ पहुँचा देती है जितना \
आपका शरीर चाहेगा।"""

KMY_EN = """\
Two journeys share most of a name and are not the same thing. Booking one while \
picturing the other is a serious mistake, so here is the difference in plain terms.

**Adi Kailash and Om Parvat** is what we run. It stays inside India, in the Vyas \
valley of Pithoragarh district. It needs an Inner Line Permit, which is issued at \
Dharchula or Pithoragarh. It is a matter of days rather than weeks. There is no \
foreign visa, no border crossing, and no fixed upper age limit set by the district \
administration, though every traveller is medically screened at Dharchula and again \
at Gunji.

**The Kailash Manasarovar Yatra** is the Government of India pilgrimage to Mount \
Kailash and Lake Manasarovar in Tibet, run by the Ministry of External Affairs. It \
crosses into China at Lipulekh. In 2026 it ran ten batches of fifty over June to \
August, at roughly two lakh nine thousand rupees, over twenty two days. Applications \
closed in May and places are allocated by a draw of lots.

Its conditions are strict and worth reading before anybody sets their heart on it. \
The age limit is eighteen to seventy as on the first of January. Body mass index must \
be twenty five or below. Applicants with high blood pressure, diabetes, asthma, heart \
disease or epilepsy are not eligible. Anyone found medically unfit at any stage is not \
permitted to continue. The government's own advisory notes trekking at altitudes up to \
nineteen and a half thousand feet, and every yatri signs a consent form for cremation \
of their remains on the Chinese side in the event of death. Evacuation by helicopter \
for a serious health problem is at the traveller's own cost.

We do not run that yatra and we cannot get anybody a place on it; it is applied for \
directly through the Ministry. If Mount Kailash in Tibet is what you are looking for, \
we would rather tell you that plainly than sell you the journey we do run."""

KMY_HI = """\
दो यात्राओं के नाम लगभग एक जैसे हैं और वे एक ही चीज़ नहीं हैं। एक को बुक करके दूसरी की \
कल्पना करना गंभीर भूल है।

**आदि कैलाश और ॐ पर्वत** वह यात्रा है जो हम कराते हैं। यह भारत के भीतर, पिथौरागढ़ की व्यास \
घाटी में रहती है। इसके लिए इनर लाइन परमिट चाहिए, जो धारचूला या पिथौरागढ़ में बनता है। \
कोई विदेशी वीज़ा नहीं, कोई सीमा पार नहीं।

**कैलाश मानसरोवर यात्रा** भारत सरकार की तिब्बत स्थित कैलाश पर्वत और मानसरोवर की \
तीर्थयात्रा है, जो विदेश मंत्रालय संचालित करता है। 2026 में यह जून से अगस्त तक पचास-पचास \
के दस जत्थों में चली, लगभग दो लाख नौ हज़ार रुपये में, बाईस दिन की।

उसकी शर्तें कठोर हैं। आयु अठारह से सत्तर वर्ष। बॉडी मास इंडेक्स पच्चीस या कम। उच्च रक्तचाप, \
मधुमेह, दमा, हृदय रोग या मिर्गी वाले पात्र नहीं हैं। सरकार की अपनी सलाह में उन्नीस हज़ार पाँच \
सौ फ़ुट तक की ऊँचाई का उल्लेख है, और हर यात्री मृत्यु की स्थिति में चीनी पक्ष में अंतिम \
संस्कार के लिए सहमति पत्र पर हस्ताक्षर करता है।

हम वह यात्रा नहीं कराते और किसी को उसमें स्थान नहीं दिला सकते; उसके लिए सीधे मंत्रालय में \
आवेदन होता है। यदि आप तिब्बत का कैलाश चाहते हैं तो हम यह स्पष्ट कह देना बेहतर समझते हैं।"""

COSTS_EN = """\
Two costs sit outside any journey price, and we can be precise about one of them and \
not the other.

**The permit fee, we do not know.** There is no official figure in any government \
document or mainstream report we have been able to find. Operators quote two hundred \
rupees, three to four hundred, six hundred, and two hundred to eight hundred, and \
those cannot all be right. Rather than pick the middle one and let you budget against \
a number we invented, we are telling you it is unknown and that the office at \
Dharchula can confirm it. Payments made on the permit portal are not refundable once \
a permit is approved.

**The green cess, we can state.** Uttarakhand has charged it on out-of-state vehicles \
at the state boundary since December 2025, collected automatically by number-plate \
recognition rather than at a barrier. It is eighty rupees for a small car, one hundred \
and forty for a bus, two hundred and fifty for a small goods carrier, and between one \
hundred and twenty and seven hundred for larger trucks. It is not specific to this \
route, and it applies to anybody driving in from another state.

If you are travelling with us, transport is arranged and this is our cost rather than \
yours. It is here because a good number of people drive themselves, and because a \
charge that appears without warning is the kind of thing that sours a trip before it \
starts."""

COSTS_HI = """\
दो खर्च यात्रा की कीमत के बाहर आते हैं। एक के बारे में हम सटीक हो सकते हैं, दूसरे के बारे में \
नहीं।

**परमिट शुल्क हमें नहीं पता।** किसी सरकारी दस्तावेज़ या मुख्यधारा की रिपोर्ट में यह आँकड़ा \
नहीं मिला। संचालक दो सौ, तीन से चार सौ, छह सौ, और दो सौ से आठ सौ रुपये बताते हैं, और ये \
सब सही नहीं हो सकते। बीच का अंक चुनकर आपको ग़लत बजट देने से बेहतर है यह कह देना कि यह \
अज्ञात है। परमिट स्वीकृत होने के बाद पोर्टल पर किया भुगतान वापस नहीं होता।

**ग्रीन सेस हम बता सकते हैं।** दिसंबर 2025 से उत्तराखंड राज्य की सीमा पर दूसरे राज्यों के \
वाहनों से यह वसूलता है, नंबर प्लेट पहचान के ज़रिए स्वतः। छोटी कार अस्सी रुपये, बस एक सौ \
चालीस, छोटा माल वाहन दो सौ पचास, और बड़े ट्रक एक सौ बीस से सात सौ तक।

यदि आप हमारे साथ यात्रा कर रहे हैं तो परिवहन की व्यवस्था हमारी है और यह खर्च हमारा है। यह \
यहाँ इसलिए है क्योंकि बहुत से लोग स्वयं गाड़ी चलाकर आते हैं।"""

HAZARD_EN = """\
This page is mostly about what does not exist, because assuming otherwise is the \
dangerous mistake.

**No official source reports road status above Tawaghat.** The Uttarakhand public \
works register covers the corridor on paper, and its entry for the Gunji to \
Jolingkong road has one record, from over a year ago. Dharchula and Lipulekh have \
none at all. So when a road status page shows nothing for the high route, that means \
nobody has published anything, not that the road is clear. Our own status page marks \
those segments as unconfirmed rather than open, for exactly this reason.

**No weather station exists on this route.** The nearest one reporting actual \
observed conditions is at Pantnagar, two hundred and thirty kilometres away and two \
hundred and thirty six metres above sea level, on the far side of the range. Every \
temperature you see for Gunji or Nabhidhang, from us or from anybody, is a computer \
model's estimate. We correct ours for the real elevation of each place, which most \
weather apps do not, and it is still a model.

**No glacial lake outburst warning system covers this valley.** There is a national \
inventory listing six moraine-dammed lakes in the headwaters of the Kali, four of them \
in the highest risk class, one of them feeding the Kuthi Yankti which joins the Kali \
at Gunji. There is no feed, no gauge and no alert. We would rather you knew that than \
assumed somebody is watching.

**There is no hospital above Dharchula.** Medical cover on the whole stretch above the \
town rests on the Indo-Tibetan Border Police and the Army.

None of this means the journey should not be made. People make it safely every \
season, and the road is better than it has ever been. It means the margin comes from \
judgement, local knowledge and turning back early, rather than from a system that \
will tell you when something is wrong."""

HAZARD_HI = """\
यह पृष्ठ मुख्यतः इस बारे में है कि क्या मौजूद नहीं है, क्योंकि इसके विपरीत मान लेना ही \
ख़तरनाक भूल है।

**तवाघाट से ऊपर सड़क की स्थिति कोई आधिकारिक स्रोत नहीं बताता।** उत्तराखंड लोक निर्माण \
रजिस्टर में गुंजी से ज्योलिंगकोंग सड़क की एक ही प्रविष्टि है, वह भी एक वर्ष से अधिक पुरानी। \
इसलिए जब किसी पृष्ठ पर ऊपरी मार्ग के लिए कुछ नहीं दिखता, तो इसका अर्थ है कि किसी ने कुछ \
प्रकाशित नहीं किया, यह नहीं कि सड़क खुली है।

**इस मार्ग पर कोई मौसम केंद्र नहीं है।** वास्तविक अवलोकन बताने वाला निकटतम केंद्र पंतनगर \
में है, दो सौ तीस किलोमीटर दूर। गुंजी या नाभीढांग का जो भी तापमान आप देखते हैं, वह मॉडल \
का अनुमान है। हम उसे हर स्थान की वास्तविक ऊँचाई के लिए सुधारते हैं, फिर भी वह मॉडल ही है।

**इस घाटी के लिए हिमनद झील विस्फोट की कोई चेतावनी प्रणाली नहीं है।** काली नदी के उद्गम \
क्षेत्र में छह मोरेन-बाँध झीलें सूचीबद्ध हैं, जिनमें चार सर्वोच्च जोखिम श्रेणी में हैं। कोई \
निगरानी, कोई चेतावनी नहीं।

**धारचूला से ऊपर कोई अस्पताल नहीं है।**

इसका अर्थ यह नहीं कि यात्रा नहीं करनी चाहिए। हर मौसम में लोग सुरक्षित यात्रा करते हैं। \
इसका अर्थ है कि सुरक्षा विवेक, स्थानीय जानकारी और समय रहते लौट आने से आती है, किसी ऐसी \
प्रणाली से नहीं जो गड़बड़ होने पर आपको बता देगी।"""


GUIDES: list[dict] = [
    {
        "slug": "is-the-road-motorable",
        "cluster": ArticleCluster.ROUTE_AND_STATUS,
        "is_pillar": True,
        "title": t(
            "Is the road to Adi Kailash motorable, or do I have to trek?",
            "क्या आदि कैलाश तक सड़क मोटर योग्य है, या पैदल चलना पड़ेगा?",
        ),
        "answer": t(
            "Motorable. The Ministry of External Affairs stated in May 2026 that both "
            "routes are now fully motorable with very little trekking, and its 2026 "
            "itinerary covers Dharchula to Gunji by jeep. Most of what is written "
            "online still describes the old five-day walk.",
            "मोटर योग्य है। विदेश मंत्रालय ने मई 2026 में कहा कि दोनों मार्ग अब पूरी तरह "
            "मोटर योग्य हैं। इंटरनेट पर लिखा अधिकतर विवरण पुरानी पाँच दिन की पैदल "
            "यात्रा का है।",
        ),
        "body": t(MOTORABLE_EN, MOTORABLE_HI),
        "faqs": [
            (
                t(
                    "Why do so many pages still say 200 km of trekking?",
                    "इतने पृष्ठ आज भी दो सौ किलोमीटर पैदल क्यों बताते हैं?",
                ),
                t(
                    "Because it was true before the road, and because the Ministry's "
                    "own FAQ page still says it. That page contradicts the same "
                    "Ministry's 2026 itinerary and its May 2026 statement.",
                    "क्योंकि सड़क बनने से पहले यह सच था, और मंत्रालय के अपने प्रश्नोत्तर "
                    "पृष्ठ पर आज भी यही लिखा है। वह पृष्ठ उसी मंत्रालय की 2026 की सूची "
                    "का खंडन करता है।",
                ),
            ),
            (
                t(
                    "Does a motorable road make this an easy trip?",
                    "क्या मोटर सड़क से यह यात्रा आसान हो जाती है?",
                ),
                t(
                    "No. The difficulty is altitude, not distance, and a vehicle "
                    "gains height faster than a body adjusts. There is also no "
                    "hospital above Dharchula.",
                    "नहीं। कठिनाई ऊँचाई है, दूरी नहीं, और वाहन शरीर के अभ्यस्त होने से "
                    "तेज़ ऊँचाई चढ़ता है। धारचूला से ऊपर कोई अस्पताल भी नहीं है।",
                ),
            ),
        ],
    },
    {
        "slug": "adi-kailash-or-kailash-mansarovar",
        "cluster": ArticleCluster.PREPARATION,
        "is_pillar": False,
        "title": t(
            "Adi Kailash or Kailash Mansarovar? They are not the same journey",
            "आदि कैलाश या कैलाश मानसरोवर? ये एक ही यात्रा नहीं हैं",
        ),
        "answer": t(
            "Adi Kailash and Om Parvat stay inside India and need only an Inner Line "
            "Permit. The Kailash Mansarovar Yatra crosses into Tibet, runs 22 days, "
            "costs about 2.09 lakh, caps age at 70 and requires a Chinese visa. We "
            "run the first and cannot get anybody a place on the second.",
            "आदि कैलाश और ॐ पर्वत भारत के भीतर हैं और केवल इनर लाइन परमिट चाहिए। "
            "कैलाश मानसरोवर यात्रा तिब्बत जाती है, बाईस दिन की है, लगभग 2.09 लाख की "
            "है, आयु सीमा सत्तर वर्ष है और चीनी वीज़ा चाहिए।",
        ),
        "body": t(KMY_EN, KMY_HI),
        "faqs": [
            (
                t(
                    "Can you book me on the Kailash Mansarovar Yatra?",
                    "क्या आप मुझे कैलाश मानसरोवर यात्रा में बुक कर सकते हैं?",
                ),
                t(
                    "No. It is applied for directly through the Ministry of External "
                    "Affairs and places are allocated by a draw of lots. Anybody "
                    "offering to secure you a place is not describing how it works.",
                    "नहीं। इसके लिए सीधे विदेश मंत्रालय में आवेदन होता है और स्थान लॉटरी "
                    "से मिलते हैं। जो कोई स्थान दिलाने की बात करे, वह सही नहीं बता रहा।",
                ),
            ),
        ],
    },
    {
        "slug": "costs-beyond-the-journey",
        "cluster": ArticleCluster.COST_AND_TIERS,
        "is_pillar": False,
        "title": t(
            "What will this cost beyond the journey price?",
            "यात्रा की कीमत के अलावा क्या खर्च आएगा?",
        ),
        "answer": t(
            "The permit fee we genuinely do not know: no official figure exists and "
            "operator quotes range from 200 to 800 rupees. The green cess we can "
            "state: 80 rupees for a small car at the Uttarakhand border, charged on "
            "out-of-state vehicles since December 2025.",
            "परमिट शुल्क हमें वास्तव में नहीं पता: कोई आधिकारिक आँकड़ा नहीं है और "
            "संचालकों के अंक दो सौ से आठ सौ रुपये तक हैं। ग्रीन सेस हम बता सकते हैं: "
            "उत्तराखंड सीमा पर छोटी कार के लिए अस्सी रुपये।",
        ),
        "body": t(COSTS_EN, COSTS_HI),
        "faqs": [],
    },
    {
        "slug": "what-nobody-is-watching",
        "cluster": ArticleCluster.ROUTE_AND_STATUS,
        "is_pillar": False,
        "title": t(
            "What nobody is watching on this route",
            "इस मार्ग पर कोई किस चीज़ की निगरानी नहीं कर रहा",
        ),
        "answer": t(
            "No official source reports road status above Tawaghat. No weather "
            "station exists on the route, so every temperature is a model estimate. "
            "No glacial lake warning system covers the six lakes in the Kali "
            "headwaters. And there is no hospital above Dharchula.",
            "तवाघाट से ऊपर सड़क की स्थिति कोई आधिकारिक स्रोत नहीं बताता। मार्ग पर कोई "
            "मौसम केंद्र नहीं है। काली के उद्गम की छह झीलों के लिए कोई चेतावनी प्रणाली "
            "नहीं है। और धारचूला से ऊपर कोई अस्पताल नहीं है।",
        ),
        "body": t(HAZARD_EN, HAZARD_HI),
        "faqs": [],
    },
]


async def apply(session: AsyncSession) -> int:
    now = datetime.now(UTC)
    count = 0

    for spec in GUIDES:
        article = await session.scalar(
            select(Article).where(Article.slug == spec["slug"])
        )
        created = article is None
        if article is None:
            # Every non-nullable column is set at construction, before the flush that
            # assigns an id. Creating a bare row and filling it in afterwards trips
            # the not-null constraint on `cluster`, because the flush happens first.
            article = Article(
                slug=spec["slug"],
                cluster=spec["cluster"],
                title=spec["title"],
                answer=spec["answer"],
                state=ArticleState.DRAFT,
            )
            session.add(article)
            await session.flush()

        article.cluster = spec["cluster"]
        article.title = spec["title"]
        article.answer = spec["answer"]
        article.body = spec["body"]
        article.is_pillar = spec["is_pillar"]
        article.author = AUTHOR
        article.reviewed_by = AUTHOR
        article.last_reviewed_at = now
        article.state = ArticleState.PUBLISHED
        article.published_at = article.published_at or now
        article.internal_note = NOTE

        for row in await session.scalars(
            select(ArticleFaq).where(ArticleFaq.article_id == article.id)
        ):
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

        print(
            f"  {spec['slug']:34} {'created' if created else 'updated'}, "
            f"{len(spec['faqs'])} FAQ(s)"
        )
        count += 1

    await session.commit()
    return count


async def run() -> None:
    async with SessionLocal() as session:
        count = await apply(session)
    print(f"\n{count} guide(s).")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
