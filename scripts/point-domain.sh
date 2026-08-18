#!/bin/sh
# Point sacrednorth.in at the Vercel project, and turn publishing on.
#
#   vercel login          # once, interactive, opens a browser
#   ./scripts/point-domain.sh
#
# Idempotent: re-running after fixing DNS is safe and is the expected way to use it.
#
# The order matters. The domain is added first so Vercel prints the exact A record
# for THIS project, which is not the 76.76.21.21 older guides give: this project
# resolves on the 216.198.79.x range. A wrong apex record is a silent outage, so the
# value comes from Vercel rather than from anybody's memory.
#
# The environment variable comes last, and only once DNS actually resolves, because
# NEXT_PUBLIC_SITE_URL is what turns indexing on. Setting it while the domain still
# points at a parking page would tell search engines the canonical home of every page
# is a host that does not serve the site.
set -e

DOMAIN=sacrednorth.in
ORIGIN="https://$DOMAIN"

cd "$(dirname "$0")/../apps/web"

echo "==> Linking the project"
vercel link --yes >/dev/null

echo "==> Adding $DOMAIN and www"
vercel domains add "$DOMAIN" 2>&1 || true
vercel domains add "www.$DOMAIN" 2>&1 || true

echo
echo "==> DNS records Vercel wants (put these in GoDaddy):"
vercel domains inspect "$DOMAIN" 2>&1 | sed 's/^/    /' || true

echo
echo "==> Does the domain resolve to this deployment yet?"
if curl -fsS -m 15 -o /dev/null "$ORIGIN"; then
  echo "    yes"
else
  echo "    NOT YET. Add the records above in GoDaddy, wait for propagation,"
  echo "    then run this script again. Indexing stays off until it resolves."
  exit 0
fi

echo
echo "==> Asserting the site is live at $ORIGIN"
# Only reached once the domain answers. This is the switch: robots.txt stops
# disallowing, canonicals and hreflang start being emitted, and the staging notice
# removes itself.
printf '%s' "$ORIGIN" | vercel env add NEXT_PUBLIC_SITE_URL production --force
printf '%s' "$ORIGIN" | vercel env add NEXT_PUBLIC_SITE_URL preview --force

echo "==> Redeploying so the variable takes effect"
vercel deploy --prod --yes

echo
echo "Done. One thing left, on the other host:"
echo "  Coolify -> adikailash-api -> PUBLIC_SITE_ORIGIN = $ORIGIN, then redeploy."
echo "  That only enables IndexNow submissions; nothing breaks without it."
