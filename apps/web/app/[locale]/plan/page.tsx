import { setRequestLocale } from "next-intl/server";

import { Scene } from "@/components/scene";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { api, type Locale } from "@/lib/api";
import { buildMetadata } from "@/lib/brand";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * `generateMetadata` rather than a static export, purely so the canonical can
 * carry the locale. A canonical that guessed the locale would point half the
 * site at the wrong URL.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return buildMetadata({
  title: "Plan your journey",
  description:
    "Documents, permits, altitude and preparation for the journey to Adi Kailash and Om Parvat.",
  path: "/plan",
    locale,
  });
}

export default async function PlanPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const checklist = await api.permitChecklist(locale as Locale);

  const mandatory = checklist?.requirements.filter((r) => r.is_mandatory) ?? [];
  const recommended = checklist?.requirements.filter((r) => !r.is_mandatory) ?? [];

  return (
    <main id="main" className="flex-1 register-light px-4 py-16 text-tone-strong sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="max-w-[20ch] font-serif text-4xl leading-tight sm:text-5xl">
          Plan your journey
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-tone-body">
          Adi Kailash sits inside an inner-line area. The paperwork is real, and a
          missing document at Dharchula ends the journey there. Here is what to bring
          and what we do with it.
        </p>

        {/*
          The checkpost, placed directly under the sentence about the journey ending
          there. Doc 03 wants preparation to feel concrete rather than administrative,
          and a barrier across a road does that better than another paragraph.
        */}
        <Scene
          name="permits"
          className="mt-10"
          sizes="(min-width: 896px) 896px, 100vw"
          /* The largest thing above the fold on this page, so it is the LCP. */
          priority
        />

        <section className="mt-16">
          <h2 className="font-serif text-2xl">Documents</h2>

          {/*
            Doc 03: "Do not imply that completing the website checklist guarantees
            permit approval." The API ships a disclaimer code precisely so this caveat
            cannot be rendered without the list.
          */}
          {checklist && (
            <p className="mt-4 rounded-lg bg-saffron/15 px-5 py-4 text-[15px] leading-relaxed ring-1 ring-saffron/25">
              Carrying every item below does not guarantee a permit. Permits are issued
              by the authorities, not by us, and they can pause issuance at any time. We
              submit your paperwork and tell you the outcome as soon as we have it.
            </p>
          )}

          {checklist === null ? (
            <p className="mt-6 text-tone-body">
              The document list is unavailable right now. Please ask the team.
            </p>
          ) : (
            <>
              <ul className="mt-8 space-y-6">
                {mandatory.map((req) => (
                  <li key={req.id} className="border-t border-tone-line pt-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-lg">{req.label}</h3>
                      {req.is_permit_bearing && (
                        <span className="text-sm text-tone-body">Used for your permit</span>
                      )}
                    </div>
                    {req.description && (
                      <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-tone-body">
                        {req.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {recommended.length > 0 && (
                <>
                  <h3 className="mt-12 font-serif text-xl">Strongly recommended</h3>
                  <ul className="mt-5 space-y-6">
                    {recommended.map((req) => (
                      <li key={req.id} className="border-t border-tone-line pt-5">
                        <h4 className="text-lg">{req.label}</h4>
                        {req.description && (
                          <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-tone-body">
                            {req.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-2xl">How your documents are handled</h2>
          <div className="mt-5 max-w-[64ch] space-y-4 text-[15px] leading-relaxed text-tone-body">
            <p>
              Once you have reserved, we send you a private link to upload each
              document. Files go straight into encrypted storage. They are never posted
              to a public address, and the link expires.
            </p>
            <p>
              Uploading is not approval. A named member of our team reviews every file
              and either accepts it or tells you exactly what needs correcting. You will
              always see which state each document is in rather than wondering.
            </p>
            <p>
              Only staff who need to review documents can open them, and every time one
              is opened we record who did it. We keep them no longer than the permit
              process and our records require.
            </p>
            <p>
              Please do not send identity documents over ordinary chat or email. If
              anyone asks you to, it is not us.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-2xl">Altitude and your health</h2>
          <div className="mt-5 max-w-[64ch] space-y-4 text-[15px] leading-relaxed text-tone-body">
            <p>
              This journey crosses ground high enough for altitude sickness to be a
              genuine risk, on roads that are long and rough. That is true regardless of
              how fit you are.
            </p>
            <p>
              We are not medically qualified. We cannot tell you whether this journey is
              safe for you, for your parents, or for anyone travelling with you, and we
              will not pretend otherwise. Please talk to a doctor who knows your history
              before you commit.
            </p>
            <p>
              What we can do is tell you honestly what each day demands, build in time
              to acclimatise, and slow a journey down when a group needs it. Ask us and
              we will describe the hardest day plainly.
            </p>
          </div>
        </section>

        <section className="mt-16 border-t border-tone-line pt-10">
          <h2 className="font-serif text-2xl">Still deciding?</h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-tone-body">
            Talk to someone who has driven this road, before you book anything.
          </p>
          <Link
            href="/enquire"
            className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight active:scale-[0.98]"
          >
            Speak to a Journey Guide
          </Link>
        </section>
      </div>
    </main>
  );
}
