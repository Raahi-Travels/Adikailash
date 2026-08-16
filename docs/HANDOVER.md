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

## 2. Four decisions that block launch

`isLaunchReady()` is false. These are the reasons, and all four are yours:

| Decision | What it is | Owner |
|---|---|---|
| **O1** | Legal entity name | Brand founder + adviser |
| **O2** | Operating entity disclosure (depends on O1) | Operations founder |
| **O7** | Domain | Brand founder |
| **O10** | Support hours | Operations founder |

**Nothing technical is blocked.** The site is deployed, public and working. What is
blocked is describing yourselves as a company somebody can contract with.

**The code states each gap rather than guessing.** Verified: the footer reads "Legal
entity to be confirmed" and "Operating entity to be confirmed before booking opens",
`robots.txt` disallows the whole site because no domain is settled, `supportHours`
renders as "Support hours to be confirmed", and payments are off.

**Why I did not fill these in.** A legal entity name sits under a footer heading that
reads "Who you contract with". Writing one would be inventing a legal fact about your
company on a page a customer relies on, which is a misrepresentation and the same
class of fabrication that nine demo route verifications were deleted to prevent. I
also cannot buy a domain or commit your brother to a support rota.

O1 is the one on the critical path: O2 depends on it, and doc 09 treats a false or
missing operator claim as a severity-one trust defect.

---

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
