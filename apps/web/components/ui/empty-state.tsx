import type { ReactNode } from "react";

import { SceneArt } from "@/components/scene-art";
import { Surface } from "@/components/ui/surface";

/**
 * One composed panel for every empty, error and loading state on the site.
 *
 * **On this site the empty state is not an edge case, it is the design.** There
 * are zero verified route statuses and no confirmed departures, so `/departures`
 * and most of `/status` are this component, and a page that renders a table of
 * empty rows or a shrugging grey box is telling a visitor the site is broken when
 * what is actually true is that nobody has driven up there and checked yet.
 *
 * So it is composed rather than apologetic: a real surface, the brand's own ridge
 * illustration feathered into it, a heading at title size, an explanation of what
 * has to happen before there is anything here, and exactly one action.
 *
 * Never invent a reason. "Departures for 2026 have not been confirmed" is true;
 * "Departures coming soon" is a promise with a date hidden inside it.
 *
 * ```tsx
 * <EmptyState
 *   seed="departures"
 *   title="No departure dates are confirmed yet"
 *   body="Dates go up once the permits for that window are issued and a coordinator has driven the road. Until then there is nothing here to book."
 *   action={<Link href="/enquire" className="cta-gold …">Ask about a date</Link>}
 * />
 * ```
 */
export function EmptyState({
  seed,
  title,
  body,
  action,
  className = "",
}: {
  /**
   * Any stable string. The same seed always draws the same ridge, so the panel
   * does not change shape between renders or between server and client.
   */
  seed: string;
  title: ReactNode;
  body: ReactNode;
  /** One action. Two actions in an empty state means neither is the next step. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Surface radius="frame" className={`relative overflow-hidden ${className}`}>
      {/* Masked, and holding nothing but the artwork: the text below is a sibling,
          so none of it fades. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 mask-b-from-40% opacity-60 sm:h-64"
      >
        <SceneArt seed={seed} />
      </div>
      {/* No scrim here, and that is the one sanctioned exception to the
          mask-and-scrim pair. A scrim resolves to `--color-scrim`, the *section's*
          ground, and this artwork sits on the panel's raised surface instead. A
          navy wash across the foot of a white panel is worse than the hard edge it
          would be hiding, and the mask has nothing muddy to pass through: this is
          flat vector illustration at 60% over a solid fill, not a photograph. */}
      <div className="relative px-6 pb-8 pt-40 sm:px-10 sm:pb-10 sm:pt-52">
        <h2 className="type-title-2 text-tone-strong">{title}</h2>
        <p className="type-body mt-4 text-tone-body">{body}</p>
        {action && <div className="mt-8">{action}</div>}
      </div>
    </Surface>
  );
}
