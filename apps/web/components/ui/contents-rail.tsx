/**
 * A sticky contents list for the long reference pages.
 *
 * `/plan` is 2574px of grey prose in a 550px column with 640px of dead space to
 * the right of it, and `/guides` is eleven identically shaped entries with no way
 * to reach the one you want. This fills that column and turns both into something
 * navigable rather than something to scroll.
 *
 * Hidden below `lg`, deliberately: on a phone there is no dead column, and a
 * duplicate list of every heading above the content is a second page to scroll
 * past before reaching the first.
 *
 * `top: 7rem` clears the floating nav pill, and the matching
 * `scroll-padding-block-start` on `<html>` means clicking an entry does not land
 * the heading underneath the pill.
 *
 * ```tsx
 * <ContentsRail
 *   label="On this page"
 *   items={[
 *     { id: "documents", label: "Documents you will need" },
 *     { id: "altitude", label: "Altitude" },
 *   ]}
 * />
 * ```
 * The `id`s must exist on the headings, and the headings must be real elements
 * with real ids: this is an anchor list, not a scrollspy, so nothing here depends
 * on JavaScript.
 */
export function ContentsRail({
  items,
  label = "On this page",
  className = "",
}: {
  items: Array<{ id: string; label: string }>;
  label?: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className={`sticky top-28 hidden self-start lg:block ${className}`}
    >
      <p className="type-meta text-tone-muted">{label}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="type-meta block text-tone-body transition-colors duration-[var(--dur-fast)] hover:text-tone-strong"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
