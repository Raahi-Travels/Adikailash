import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

/**
 * The two button shapes on this site, and there are only two.
 *
 * **Gold budget: one filled action per viewport, plus the focus ring.** Gold on
 * midnight measures 6.67:1 and midnight on gold measures 6.67:1, so a gold fill
 * with a midnight label is safe in both registers and is deliberately *not*
 * flipped to navy on light pages: the primary action should be one object
 * everywhere rather than a colour that follows the section. Gold text, by
 * contrast, is 2.37:1 on snow, so gold is never a link, never body copy, never a
 * status, never a border.
 *
 * 48px minimum height, up from the 36px the old buttons had, because this
 * audience is largely tapping on a phone.
 */

const SHARED =
  "inline-flex min-h-12 items-center justify-center rounded-pill px-6 text-center transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * The one gold action. `href` may be internal (routed through the locale-aware
 * `Link`) or an absolute URL such as a WhatsApp deep link.
 */
export function PrimaryAction({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = `cta-gold type-meta font-semibold ${SHARED} ${className}`;
  if (/^https?:|^mailto:|^tel:/.test(href)) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/**
 * The second action, in the register's own tone.
 *
 * A hairline ring rather than a border, at the same alpha the panels use, so a row
 * of two actions reads as one primary and one alternative rather than as two
 * buttons of different families.
 */
export function QuietAction({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = `type-meta font-medium text-tone-strong shadow-[0_0_0_1px_var(--glass-ring)] hover:shadow-[0_0_0_1px_var(--color-tone-line)] ${SHARED} ${className}`;
  if (/^https?:|^mailto:|^tel:/.test(href)) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/**
 * A reading column at the site's measure.
 *
 * Wraps content in `.prose-sn`, which sets every element inside it to one of the
 * seven type classes: a heading inside prose is the same size as a heading outside
 * it. 72ch, which at 17 to 19px is 620 to 700px, and which is the cap that stops
 * the 110ch to 149ch runs the audit found on `/status`, `/guides` and `/policies`.
 *
 * Use it for long-form and for anything rendered from data whose elements you
 * cannot put classes on. For a hand-written page, the type classes directly are
 * clearer.
 */
export function Prose({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`prose-sn ${className}`}>{children}</div>;
}
