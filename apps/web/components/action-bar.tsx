"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";

/**
 * The phone's standing offer: one live fact, one way to act on it.
 *
 * **Why this exists at all.** Surveying travel products on Mobbin, every tour
 * and booking detail page carries a sticky bar at the foot of the screen with
 * the same two parts: the fact that anchors the decision on the left, and the
 * action on the right. Viator prints "From $25.65" beside "Check availability";
 * Booking.com "From $3.45" beside "See availability"; GetYourGuide "From $78.00
 * per person" beside the same. Six of six. It is not decoration, it is the
 * pattern that keeps the way to act on screen while somebody reads.
 *
 * **Ours cannot be a price.** Payments are off and deposit terms are not
 * approved, so there is no number to print, and inventing one is the failure
 * this codebase spends most of its guardrails preventing. But the anchoring
 * fact does not have to be a price. On this route it is the road: whether
 * permits are being issued, and how many legs anybody has actually confirmed.
 * That is the thing a pilgrim is deciding on, it is live, and a competitor
 * cannot copy it by editing their homepage.
 *
 * **It also answers the navigation problem.** The same survey found that not one
 * of six travel apps hides navigation behind a bare hamburger; they all keep a
 * persistent bar at the foot of the screen. A marketing site with six pages does
 * not want an app's tab bar, but it should not depend on a reader guessing that
 * an icon opens something either. Between the labelled menu button in the header
 * and a permanent way to reach a person down here, nobody has to guess.
 *
 * **It waits.** Anchored to a sentinel rather than a scroll listener, so it
 * costs nothing per frame, and it stays out of the way until the hero's own two
 * buttons have left the screen. A sticky call to action covering the call to
 * action is worse than no sticky bar.
 */
export function ActionBar({
  href,
  action,
  condition,
  conditionHref,
}: {
  /** Where the primary action goes. A WhatsApp deep link, or the enquiry form. */
  href: string;
  action: string;
  /** The live fact. Kept short: this is one line on a 390px screen. */
  condition: string;
  conditionHref: string;
}) {
  const [shown, setShown] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    // Visible once the sentinel has left the top of the viewport, which is the
    // same trick the nav pill uses to decide it has lifted.
    const io = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      { rootMargin: "-40% 0px 0px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute top-0 h-px w-px" />

      <motion.div
        // `pointer-events-none` on the shell so the strip never eats a tap meant
        // for the page behind it when it is hidden.
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        initial={false}
        animate={
          reduce
            ? { opacity: shown ? 1 : 0 }
            : { y: shown ? 0 : 96, opacity: shown ? 1 : 0 }
        }
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden={!shown}
      >
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-pill px-2 py-2 pl-4">
          <Link
            href={conditionHref}
            className="type-meta min-w-0 flex-1 truncate text-tone-on-glass"
            tabIndex={shown ? undefined : -1}
          >
            {condition}
          </Link>

          <a
            href={href}
            className="type-meta inline-flex min-h-11 shrink-0 items-center rounded-pill bg-gold px-5 font-semibold text-midnight transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
            tabIndex={shown ? undefined : -1}
          >
            {action}
          </a>
        </div>
      </motion.div>
    </>
  );
}
