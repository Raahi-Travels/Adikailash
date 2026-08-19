import { setRequestLocale } from "next-intl/server";

import { FeedbackForm } from "@/components/feedback-form";
import { Content } from "@/components/ui/band";
import { Surface } from "@/components/ui/surface";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/api";
import { brand, buildMetadata, display } from "@/lib/brand";

/**
 * The private post-trip form (doc 07 step 1).
 *
 * `noindex` because the URL carries a capability token. Also because a feedback
 * form has no business in search results.
 *
 * **A quiet page**, which `globals.css` already names as one alongside the trip
 * companion and the family share: `data-quiet-page` removes the marketing nav and
 * the footer. Asking somebody what went wrong while a gold Enquire button floats
 * over the question is the wrong room to ask it in. The wordmark stays, and links
 * home, so nobody who follows the link is stranded.
 *
 * Dark register, like its two siblings. It is also the one place on the site that
 * proves the shared `.field` works on navy as well as on snow.
 */

export const metadata = {
  ...buildMetadata({
    title: "How was your journey?",
    description: "Private feedback after your journey.",
    path: "/feedback",
  }),
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;

  return (
    <main
      id="main"
      data-quiet-page
      data-register-mark="dark"
      className="register-dark flex-1 py-[var(--band-y-tight)]"
    >
      <Content>
        <Link
          href="/"
          className="wordmark inline-block text-tone-strong underline-offset-4 hover:underline"
        >
          {display(brand.identity.shortName)}
        </Link>

        <div className="mt-[var(--space-2xl)] grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <header className="lg:col-span-5 lg:sticky lg:top-10 lg:self-start">
            <h1 className="type-title-1 text-tone-strong">How was it, honestly?</h1>
            <p className="type-lead mt-[var(--stack-title)] text-tone-body">
              This goes to the three of us and nowhere else. It is not a review, it
              will not be published, and nothing you write here appears on the
              website.
            </p>
            <p className="type-meta measure-meta mt-8 text-tone-body">
              If something went wrong we would much rather hear it from you now. We
              will call you about it before we ask you for anything else.
            </p>
            <p className="type-meta measure-meta mt-4 text-tone-body">
              Nothing on this form is required. Send it half filled if that is what
              you have time for.
            </p>
          </header>

          <div className="lg:col-span-7">
            {token ? (
              <FeedbackForm token={token} />
            ) : (
              <Surface radius="frame" className="p-6 sm:p-8">
                <h2 className="type-title-2 text-tone-strong">
                  This link is missing its token.
                </h2>
                <p className="type-body mt-4 text-tone-body">
                  Without it we cannot tell which journey the feedback is about.
                  Please open the link exactly as we sent it, or write to us directly
                  and we will send a fresh one.
                </p>
                <p className="type-meta mt-6 text-tone-body">
                  {display(brand.contact.baseCity)}.
                </p>
              </Surface>
            )}
          </div>
        </div>
      </Content>
    </main>
  );
}
