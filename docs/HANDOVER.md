# What needs a human

Two things are open. Neither is unfinished work; both need someone who is not me.

Everything else is done and verified: the design system reaches every page, all five
live sources report in production, the research findings are seeded, and the deploy
pipeline verifies the exact commit it shipped.

---

## 1. Rotate the Coolify API token (5 minutes)

A full-scope Coolify token was printed into a session transcript on 16 Aug 2026.

**How exposed is it, really.** Port 8000 is filtered upstream by Hostinger, so
Coolify's API is unreachable from the internet. This is the same block that forced
the SSH-with-forced-command deploy design. Using the token requires shell access to
the box first, at which point it is not the weakest thing available. It is hygiene
rather than an open door, which is why nothing here is urgent.

**Why I could not do it.** Coolify 4.0.0-beta.462 exposes no token API, so creation
is a UI action. Attempting it through Laravel's own `createToken()` inside the
container was refused by this environment's permission classifier, which is a
reasonable guardrail around minting credentials and not one to route around.

**What to do.** Coolify, Keys and Tokens. Revoke `adikailash-setup` (id 27, abilities
`*`). Create one named `adikailash-deploy` with the `deploy` ability only, which is
all `/root/deploy-adikailash.sh` needs. Then:

```
ssh root@72.62.241.119
printf '%s' 'NEW_TOKEN_HERE' > /root/.coolify_ak_token
chmod 600 /root/.coolify_ak_token
```

Nothing else reads it. Push any change under `apps/api/` to confirm the pipeline
still deploys.

**Considered and rejected:** calling `queue_application_deployment()` from tinker
would remove the token from the deploy path entirely. It is a fourteen-parameter
internal helper on a beta release, and trading a supported API call for unsupported
internals, on a server running another product's production, to avoid a five-minute
UI action, buys a silently broken pipeline later.

---

## 2. Point the domain at Vercel (was: four launch decisions)

**All four decisions are settled** as of 17 Aug 2026, so `isLaunchReady()` is now
true: the entity is Sacrednorth, it both sells and operates, the domain is settled,
and support hours are 9am to 7pm IST daily.

One thing remains, and it is DNS rather than a decision. **The settled domain had no
DNS records at all** when it was set, so publishing under it would have pointed every
canonical at a host that does not resolve and invited search engines to drop the URL
that works.

The code now separates the two facts. `brand.web.domain` records the decision and
publishes nothing on its own. `NEXT_PUBLIC_SITE_URL` asserts the deployment is
actually served there, and that is what turns indexing on.

So when DNS resolves:

1. Add the domain to the Vercel project and let it issue a certificate.
2. Set `NEXT_PUBLIC_SITE_URL` to the origin in Vercel. Indexing turns on, canonicals
   and `hreflang` start being emitted, and the staging notice disappears by itself.
3. Set `PUBLIC_SITE_ORIGIN` to the same value in Coolify, which enables IndexNow
   submissions from the API.

Until then robots.txt disallows everything and says exactly why, which is correct.

**Two things worth a second look**, neither of which I changed:

- `Sacrednorth` was given as the registered legal entity name and is recorded
  verbatim, as promised. It carries no entity suffix (Private Limited, LLP), which is
  unusual for a registered Indian company and normal for a proprietorship trading
  name. It sits under "Who you contract with", so if the registration reads
  differently, correct it in `apps/web/lib/brand/config.ts`.
- `registrationNumber` and `registeredAddress` remain undecided. A name was supplied
  and those were not, they are not launch-critical, and inventing one to make a
  footer look complete is what this config exists to prevent.

## Two smaller things, for completeness

- **`ops@example.invalid`** still exists in `yatra.staff_users` with `ops_manager`,
  `status_publisher` and `content_editor`. It is a demo row with more privilege than
  it should have. I left it because sign-in runs through better-auth tables in the
  `public` schema, which belong to Raahi (decision D6) and are not ours to read, so I
  could not confirm whether disabling the only admin account would lock you out.
  Remove it once a real staff account exists.

- **Nine scene images** are AI placeholders in slots that stand in for named real
  places. `bun run check:imagery` lists them. It gates nothing and is not in CI, by
  your instruction, and the claim-versus-decoration rule means generated imagery is
  fine everywhere else.
