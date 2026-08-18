#!/bin/sh
# Finish the domain switch-on once the GoDaddy records are in.
#
#   ./scripts/finish-domain.sh          # check, and complete if DNS has landed
#   ./scripts/finish-domain.sh --watch  # poll until it lands, then complete
#
# The Vercel side is already done: sacrednorth.in and www are attached to the
# adikailash project and ownership is verified. What is missing is DNS.
#
# Records to set at GoDaddy (these are this project's, read from Vercel, not the
# 76.76.21.21 that older guides give):
#
#   delete   A      @      (currently "WebsiteBuilder Site", the parking page)
#   add      A      @      216.198.79.1
#   add      A      @      64.29.17.1
#   add      CNAME  www    cname.vercel-dns.com
#
# Leave the NS rows alone.
set -e

DOMAIN=sacrednorth.in
ORIGIN="https://$DOMAIN"
EXPECTED_1=216.198.79.1
EXPECTED_2=64.29.17.1

resolves() {
  got=$(dig +short "$DOMAIN" A | tr '\n' ' ')
  case "$got" in
    *"$EXPECTED_1"*|*"$EXPECTED_2"*) return 0 ;;
    *) echo "    A record is now: ${got:-<empty>}"; return 1 ;;
  esac
}

if [ "$1" = "--watch" ]; then
  echo "==> Waiting for $DOMAIN to point at Vercel (Ctrl-C to stop)"
  while ! resolves; do sleep 30; done
else
  echo "==> Checking DNS"
  if ! resolves; then
    echo "    Not pointed at Vercel yet. Add the records in the header of this file,"
    echo "    then run this again, or run it with --watch."
    exit 0
  fi
fi

echo "==> DNS is correct. Waiting for the certificate to issue."
until curl -fsS -m 15 -o /dev/null "$ORIGIN"; do
  echo "    $ORIGIN not serving yet"
  sleep 20
done
echo "    $ORIGIN is serving"

cd "$(dirname "$0")/../apps/web"

echo "==> Turning publishing on"
# This is the switch. Until it is set the site deliberately renders as provisional:
# robots.txt disallows everything, no canonical is emitted, and the staging notice
# shows. Setting it before the domain resolved would have pointed every canonical at
# a host that did not answer.
for env in production preview; do
  vercel env rm NEXT_PUBLIC_SITE_URL "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$ORIGIN" | vercel env add NEXT_PUBLIC_SITE_URL "$env" >/dev/null
  echo "    NEXT_PUBLIC_SITE_URL set for $env"
done

echo "==> Redeploying so the variable takes effect"
vercel deploy --prod --yes 2>&1 | tail -3

echo
echo "==> Verifying"
sleep 10
printf '    robots.txt: '; curl -fsS -m 15 "$ORIGIN/robots.txt" | head -2 | tr '\n' ' '; echo
printf '    CORS from the new origin: '
bun run check:origins --live 2>&1 | tail -1

echo
echo "Left to do by hand, on the other host:"
echo "  Coolify -> adikailash-api -> PUBLIC_SITE_ORIGIN = $ORIGIN, then redeploy."
echo "  That only enables IndexNow; nothing breaks without it."
