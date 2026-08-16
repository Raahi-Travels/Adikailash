import { setRequestLocale } from "next-intl/server";

import { UnsubscribeForm } from "@/components/unsubscribe-form";
import { buildMetadata } from "@/lib/brand";
import type { Locale } from "@/lib/api";

/**
 * Leaving the alert list.
 *
 * **The click does not unsubscribe on page load, and that is not a hedge.** Corporate
 * mail security scanners and link-preview crawlers fetch every URL in an incoming
 * message before the recipient ever sees it. A GET that mutates would unsubscribe
 * people who never opened the mail, and we would have no way to know it happened. The
 * page renders a single button that POSTs — one click, no login, no reason asked, no
 * "are you sure you want to miss out".
 *
 * `noindex` because the URL carries a capability token.
 */

export const metadata = {
  ...buildMetadata({
    title: "Stop route alerts",
    description: "Unsubscribe from Adi Kailash route and permit status alerts.",
    path: "/unsubscribe",
  }),
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
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
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl">Stop route alerts</h1>

      {token ? (
        <>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-tone-body">
            One click and we stop. Anything already waiting to be sent to you is
            cancelled too, not just future messages.
          </p>
          <UnsubscribeForm token={token} />
        </>
      ) : (
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-tone-body">
          This link is missing its token, so we cannot tell which subscription to
          stop. Use the link at the bottom of any alert we sent you, or write to us
          and we will do it by hand.
        </p>
      )}
    </main>
  );
}
