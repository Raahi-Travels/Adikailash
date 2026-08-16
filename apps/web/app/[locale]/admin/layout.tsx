import { Link } from "@/i18n/navigation";
import { currentStaff } from "@/lib/admin-api";

/**
 * Never prerendered. Every admin page is per-user authenticated content, and
 * static generation would both leak a shared shell and force a database connection
 * at build time on hosts that supply env vars only at runtime.
 */
export const dynamic = "force-dynamic";

/**
 * `noindex` on the whole admin tree, inherited by every page under it.
 *
 * robots.txt already disallows `/admin`, and that is *not* sufficient on its own:
 * Disallow stops a crawler fetching a URL, but Google will still index a disallowed
 * URL it finds linked elsewhere, showing the bare address with no description. The
 * two directives do different jobs — Disallow controls crawling, `noindex` controls
 * indexing — and for a page that must never appear in a result at all, this is the
 * one that actually says so.
 *
 * Neither is access control. That is `currentStaff()` below and the role checks on
 * every API endpoint behind it; these two only keep an operations screen out of
 * search results.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Admin shell.
 *
 * Doc 02: the internal system "prioritises density, status, ownership and exceptions
 * over brand atmosphere. Use the same colour tokens, but do not force decorative
 * travel imagery into operational dashboards." Hence no hero, no serif display, no
 * photography: labels, state and who is signed in.
 */

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leads", label: "Enquiries" },
  { href: "/admin/reservations", label: "Reservations" },
  { href: "/admin/status", label: "Publish status" },
  { href: "/admin/journeys", label: "Journeys" },
  { href: "/admin/departures", label: "Departures" },
  { href: "/admin/incidents", label: "Incidents" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/attribution", label: "Contribution" },
  { href: "/admin/spend", label: "Spend" },
  { href: "/admin/guides", label: "Guides" },
  { href: "/admin/assist", label: "Assistant" },
];

export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const staff = await currentStaff();

  if (!staff) {
    return (
      <main id="main" className="flex-1 register-dark px-4 py-24 text-tone-strong">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-medium">Staff sign-in required</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-tone-body">
            This area manages departures, verified route status and traveller
            documents. Accounts are created by an administrator; there is no self
            sign-up.
          </p>
          <Link
            href="/staff-signin"
            className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const roles = (staff as { roles?: string[] }).roles ?? [];

  return (
    <main id="main" className="flex-1 register-dark">
      <div className="border-b border-tone-line px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-sm font-medium">Operations</span>
          <nav className="flex flex-wrap gap-5" aria-label="Admin">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-tone-body hover:text-tone-strong"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="ml-auto text-sm text-tone-muted">
            {staff.name}
            {roles.length > 0 && (
              <span className="ml-2 text-tone-muted">{roles.join(", ")}</span>
            )}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</div>
    </main>
  );
}
