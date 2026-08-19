"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Link } from "@/i18n/navigation";

export type SheetLink = { href: string; label: string };

/**
 * The mobile navigation, as a bottom sheet.
 *
 * **It replaces a second scrolling nav row that was clipping its own links.** The
 * old header put a horizontally scrolling strip of the five main links under the
 * bar; at 390px it cut "Plan Your Journey" off mid-word, and earlier still in
 * Hindi, and it cost 50px of permanent chrome on the screen size that can least
 * afford it. Total mobile chrome is now 56px of pill plus its 12px inset, down from
 * 106px in English and 111px in Hindi.
 *
 * A sheet rather than a full-screen overlay because a thumb reaches the bottom of a
 * phone and not the top, and the links are set at title size for the same reason:
 * this is the audience most likely to be reading on mobile data with reading
 * glasses somewhere else.
 *
 * Accessibility, all of it required and none of it optional:
 * focus moves into the sheet and is trapped there, `Escape` closes, the rest of the
 * page is made `inert` so a screen reader cannot wander behind the sheet, the page
 * behind cannot scroll, and focus returns to the button that opened it.
 */
export function NavSheet({
  links,
  extra,
  title,
  openLabel,
  closeLabel,
}: {
  /** The main navigation, in the same order as the desktop pill. */
  links: SheetLink[];
  /** The two footer navigation links, so the sheet is a complete map of the site. */
  extra: SheetLink[];
  /** The brand string, shown as the sheet's heading. */
  title: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const sheet = sheetRef.current;
    if (!sheet) return;

    // Everything that is not the sheet's own subtree goes inert. Walking the body's
    // children rather than naming `#main` means this keeps working whatever a page
    // renders, including the staging notice and the footer.
    const inerted: HTMLElement[] = [];
    for (const node of Array.from(document.body.children)) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.contains(sheet)) continue;
      if (node.inert) continue;
      node.inert = true;
      inerted.push(node);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const node of inerted) node.inert = false;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="pointer-events-auto -mr-1 grid size-11 shrink-0 place-items-center rounded-pill text-tone-strong transition-transform duration-[var(--dur-press)] ease-standard active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100 lg:hidden"
      >
        <span className="sr-only">{openLabel}</span>
        <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none">
          <path
            d="M4 8h16M4 16h16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/*
        Portalled to `<body>`, and that is load-bearing rather than tidiness. The
        button lives inside the nav pill, and the pill carries `backdrop-filter`,
        which makes an element a containing block for `position: fixed`
        descendants. Rendered in place, the sheet would be positioned against the
        pill instead of against the viewport, and would appear as a strip inside
        the navigation bar. Portalling also puts the sheet where the `inert` walk
        above expects it: a direct child of `<body>`.
      */}
      {open &&
        createPortal(
          <div className="pointer-events-auto lg:hidden">
            <div
              aria-hidden
              onClick={close}
              className="fixed inset-0 z-40 bg-midnight/55"
            />
          <div
            ref={sheetRef}
            data-nav-sheet
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            className="register-dark ground-none glass fixed inset-x-0 bottom-0 z-50 max-h-[86vh] overflow-y-auto rounded-t-frame px-6 pb-8 pt-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id={headingId} className="type-meta text-tone-muted">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                className="-mr-2 grid size-11 place-items-center rounded-pill text-tone-strong"
              >
                <span className="sr-only">{closeLabel}</span>
                <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav aria-label="Main" className="mt-4">
              <ul>
                {links.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="type-title-2 flex min-h-14 items-center text-tone-strong"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="More" className="mt-6">
              <ul>
                {extra.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="type-meta flex min-h-12 items-center text-tone-body"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
