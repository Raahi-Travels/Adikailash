/**
 * Policy content.
 *
 * Doc 06 is unambiguous that these pages are not decoration: "Publish clear terms,
 * cancellation and refund policy, privacy policy and consent language", and warns
 * against "a website that implies guarantees the business cannot control".
 *
 * Two rules govern everything below.
 *
 * **1. Nothing here invents a fact about the business.** Where a clause depends on a
 * decision that has not been made (the contracting entity, the licensed operator, the
 * payment gateway, the refund mechanics that follow from it), the clause says so in
 * the open. A policy that names a company that does not yet exist is worse than a
 * policy with a stated gap, because a customer can rely on it.
 *
 * **2. These are drafts until a lawyer reads them.** `reviewed` records that state.
 * The page renders the honest banner; nobody has to remember to add it.
 *
 * Hindi bodies are `null` until translated. Doc 05 requires Hindi to be a real
 * translation, "not a machine-translated afterthought", and a legal document is the
 * last place to guess. The page renders the English text with a clear note rather
 * than a half-translated policy.
 */

import { brand, isSettled } from "@/lib/brand";

export type PolicySlug = "terms" | "privacy" | "cancellation" | "consent";

export type PolicySection = {
  heading: string;
  /** Paragraphs. Rendered as prose, never as a wall of bullets. */
  body: string[];
  /** Rendered as a list under the paragraphs when present. */
  points?: string[];
  /**
   * Set when this section depends on an unmade decision. Rendered as a visible gap
   * instead of being quietly omitted.
   */
  pending?: string;
};

export type Policy = {
  slug: PolicySlug;
  title: string;
  summary: string;
  /** One sentence the visitor can act on without reading the whole page. */
  inShort: string;
  sections: PolicySection[];
  /** False until a qualified person has reviewed it. Drives the draft banner. */
  reviewed: boolean;
};

const entityClause = () => {
  const entity = brand.legal.entityName;
  return isSettled(entity)
    ? `${entity.value} ("we", "us")`
    : `the legal entity behind this website ("we", "us"), which is being registered and will be named here before we take any money`;
};

export const POLICIES: Record<PolicySlug, Policy> = {
  terms: {
    slug: "terms",
    title: "Terms of service",
    summary:
      "What you are agreeing to when you travel with us, and the limits of what we can promise on this route.",
    inShort:
      "We arrange the journey carefully and tell you the truth about conditions. We cannot promise weather, road access or darshan, and nobody honestly can.",
    reviewed: false,
    sections: [
      {
        heading: "Who you are contracting with",
        body: [
          `These terms are between you and ${entityClause()}.`,
          "Parts of this journey are operated by licensed partners who hold the registrations required for permits and high-altitude travel. Where that is the case, we name the operator on the departure you are booking. We do not present a partner's licence as our own.",
        ],
        pending: isSettled(brand.legal.entityName)
          ? undefined
          : "The contracting entity and its registration numbers are not published yet. Until they are, treat everything here as a description of intent rather than a binding contract.",
      },
      {
        heading: "What we arrange",
        body: [
          "We arrange transport, stays, permits assistance, and coordination for the itinerary shown on the journey page you booked from. What is included and what is not is listed there, and that list is the one that governs.",
          "Itineraries on this route are weather and permit dependent. We may change the order of days, substitute a stay of comparable standard, or shorten a segment where conditions require it. Where we do, we tell you why and what changed.",
        ],
      },
      {
        heading: "What we cannot promise",
        body: [
          "This is stated plainly because it is the single most common way pilgrimage travel goes wrong for people.",
        ],
        points: [
          "Darshan of Adi Kailash or Om Parvat. Cloud can sit on the peak for days. Nobody can guarantee a viewing.",
          "Road access. Landslides and snow close this road with no notice and no appeal.",
          "Permits. Inner-line permits are issued by the administration, not by us. We prepare and submit correctly; we do not decide the outcome.",
          "Weather, visibility, or your own body's response to altitude.",
        ],
      },
      {
        heading: "Health and altitude",
        body: [
          "This journey crosses high altitude, above 4,000 metres in places, with limited medical access and long evacuation times. Acute mountain sickness can affect fit, young, experienced travellers.",
          "You must tell us about existing medical conditions, medication and recent surgery when you book. We may decline or end a person's participation where we believe continuing is unsafe. That decision is about safety and is not a judgement about you.",
          "Please consult a doctor who knows your history before you commit. We are not qualified to clear you medically and will not pretend to be.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: ["Some of this journey only works if you hold up your end."],
        points: [
          "Give accurate identity details. Permits are issued against them and a mismatch stops the whole group at a checkpost.",
          "Submit documents by the dates we give you. Permit offices have deadlines we cannot move.",
          "Carry valid identification for the whole journey.",
          "Respect the villages, shrines and households that host you. This is a lived-in place, not a set.",
        ],
      },
      {
        heading: "Conduct in shared groups",
        body: [
          "On a small group departure you are travelling with other people at altitude for several days. We may ask someone to leave the group, at their own cost, for behaviour that endangers or seriously disrupts others. We have never wanted to use this clause and hope we never do.",
        ],
      },
      {
        heading: "Liability",
        body: [
          "We are responsible for arranging the services described with reasonable care and skill. We are not liable for loss caused by events outside reasonable control, including weather, road closure, administrative decisions, civil disruption, or your own medical condition.",
          "Nothing in these terms limits any liability that cannot be limited under Indian law, including liability for death or personal injury caused by negligence.",
        ],
      },
      {
        heading: "Disputes",
        body: [
          "Talk to us first. Most of what goes wrong on a trip is fixable by a phone call to a person who was there.",
          "These terms are governed by Indian law.",
        ],
        pending:
          "The jurisdiction for formal disputes will be stated here once the contracting entity is registered.",
      },
    ],
  },

  cancellation: {
    slug: "cancellation",
    title: "Cancellation and refunds",
    summary:
      "What happens to your money if you cancel, and what happens if we do. Written before you pay, not after something goes wrong.",
    inShort:
      "If we cancel or a route closes, you get your money back or a transfer to another date, your choice. If you cancel, what you get back depends on how close to departure it is, because our costs are already committed by then.",
    reviewed: false,
    sections: [
      {
        heading: "If we cancel or the route closes",
        body: [
          "If we cancel a departure, or the road or permits make the journey unviable, you choose: a full refund of what you have paid us, or a transfer of the full amount to another date within twelve months.",
          "We do not keep a service fee in this situation. The decision was ours or the mountain's, not yours.",
          "This applies to the amount you paid us. Costs you arranged separately, such as flights and trains to the gateway city, sit outside what we can refund. Please book those flexibly, or late.",
        ],
      },
      {
        heading: "If a departure has not been confirmed yet",
        body: [
          "A small group departure runs only if a minimum number of people join. Until it is confirmed, any amount you have paid is a conditional hold, not a booking.",
          "A conditional hold is fully refundable, on request, at any point before the departure is confirmed. We say clearly on the departure page which state a date is in.",
        ],
      },
      {
        heading: "If you cancel",
        body: [
          "Our costs are committed in stages, so what we can return depends on when you tell us. Tell us as early as you can and we will always try to do better than the schedule.",
        ],
        pending:
          "The refund schedule, in days before departure, is being finalised alongside the payment setup. It will be published in full here, and shown to you again before you pay, so you never have to discover it afterwards.",
      },
      {
        heading: "Medical cancellation",
        body: [
          "If you cancel on documented medical advice, or if we end your participation on medical grounds during the journey, we will refund what has not already been spent on your behalf and will tell you exactly what those committed costs were.",
          "This is not travel insurance and cannot replace it. Please take a policy that covers high-altitude travel and evacuation.",
        ],
      },
      {
        heading: "Changes to your booking",
        body: [
          "Changing dates or the number of travellers is usually possible, and how much it costs depends entirely on how close to departure you are and what we have already paid out. Ask us; we will tell you the real number.",
        ],
      },
      {
        heading: "How refunds reach you",
        body: [
          "Refunds go back by the route the money came in.",
        ],
        pending:
          "The payment method and its refund timelines are not set up yet. Until they are, no money is taken on this website at all, and any conversation about payment happens with a person.",
      },
    ],
  },

  privacy: {
    slug: "privacy",
    title: "Privacy",
    summary:
      "What we collect, why, who can see it, and how long we keep it. Identity documents get their own section because they deserve one.",
    inShort:
      "We collect what a permit and a safe journey actually require, and nothing extra. Your identity documents are seen only by the people processing your permit, and are deleted after the retention period.",
    reviewed: false,
    sections: [
      {
        heading: "What we collect",
        body: ["Three kinds of information, for three different reasons."],
        points: [
          "Contact details, when you enquire: your name, phone number, and what you asked about, so a person can call you back.",
          "Traveller details, when you book: names, dates of birth and identity document numbers exactly as the permit application requires them.",
          "Health information you choose to tell us, so we can plan safely at altitude. This is sensitive personal data and we treat it as such.",
        ],
      },
      {
        heading: "Identity documents",
        body: [
          "Permits for the inner line require identity documents. We ask for them for that reason and no other.",
          "Uploaded documents are stored encrypted, are not publicly reachable, and are opened only through short-lived links. Inside our team, only staff with an explicit document-review role can see them. Being a founder does not automatically grant access.",
          "Every time a document is viewed, that view is recorded against the person who viewed it.",
          "We keep documents for as long as the permit and the statutory record require, and then delete them. We do not keep a scan of your passport indefinitely because it might be useful later.",
        ],
      },
      {
        heading: "Who else sees your information",
        body: [
          "Permit authorities and the licensed operating partner for your departure receive what they need to issue permits and run the journey safely. That is the point of collecting it.",
          "Our own tools for messaging, storage and hosting process this data on our instruction.",
          "We do not sell your information, and we do not share it with advertisers.",
        ],
      },
      {
        heading: "Messaging",
        body: [
          "If you contact us on WhatsApp, that conversation happens on WhatsApp's platform under its own terms. We keep a record of the enquiry so a person can follow up, and we send trip-related messages, not marketing, unless you have asked for it.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "You can ask us what we hold about you, ask us to correct it, ask us to delete it, and withdraw consent for anything that is not legally required. Ask by phone or message and a person will handle it.",
          "Some records we must keep: financial records for the statutory period, and permit records for as long as the administration requires. We will tell you when that is the case rather than quietly ignoring the request.",
        ],
      },
      {
        heading: "Where your data lives",
        body: [
          "Data is stored on servers in India. Where a processor operates elsewhere, we use providers with appropriate safeguards.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "Questions about privacy go to the same people who answer everything else. There is no separate department; there are three of us.",
        ],
        pending: isSettled(brand.legal.entityName)
          ? undefined
          : "The registered address and the named grievance contact will be published here once the entity is registered, as Indian law requires.",
      },
    ],
  },

  consent: {
    slug: "consent",
    title: "Consent",
    summary:
      "The specific permissions we ask for, each one separately, and how to withdraw any of them.",
    inShort:
      "Each permission is asked for separately and none of them is bundled into booking. Saying no to photographs does not affect your journey.",
    reviewed: false,
    sections: [
      {
        heading: "Why consent is separated",
        body: [
          "It would be easier to put one tick box at the bottom of a booking form covering everything. We have not done that, because a single box means nobody actually agreed to anything in particular.",
          "Each permission below is asked for on its own, recorded with the date and the version of the wording you saw, and can be withdrawn without affecting the others.",
        ],
      },
      {
        heading: "Processing your identity documents",
        body: [
          "Required. Permits cannot be applied for without identity details, so this is the one permission we cannot make optional. If you are not comfortable with it, we cannot arrange the inner-line segment, and we would rather say that now than at a checkpost.",
        ],
      },
      {
        heading: "Health information",
        body: [
          "Optional, and strongly recommended. Knowing that someone has a heart condition or is on blood-pressure medication changes how we plan the ascent and what we carry.",
          "Shared only with the people responsible for your safety on the journey. Never used for marketing, and never mentioned to other travellers.",
        ],
      },
      {
        heading: "Photographs and stories",
        body: [
          "Optional, always. We ask separately whether we may use photographs of you, and whether we may share something you told us.",
          "Saying no changes nothing about your journey. You can withdraw this later, including after the trip, and we will remove the material from our own channels.",
          "The same rule applies to the families who host you. No household appears on this website without agreeing to it, and they can change their mind.",
        ],
      },
      {
        heading: "Messages after your journey",
        body: [
          "Optional. Trip-related messages, such as permit reminders and pickup times, are part of running the journey and are not marketing.",
          "Anything else, such as new dates or a note the following season, is only sent if you asked for it. Reply once to stop.",
        ],
      },
      {
        heading: "Withdrawing consent",
        body: [
          "Message or call the same number you have been talking to. There is no form to find and no account to log into. Tell us which permission you are withdrawing and we will action it and confirm.",
        ],
      },
    ],
  },
};

export const POLICY_ORDER: PolicySlug[] = [
  "terms",
  "cancellation",
  "privacy",
  "consent",
];
