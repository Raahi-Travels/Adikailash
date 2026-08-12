# SEO, GEO and AEO

What the three tools you found actually contain, what we took, what we refused, and
the system we are building instead.

## The one-paragraph version

None of the three tools knows anything about travel schema, bilingual sites, or live
verified data — which is to say, none of them covers the three things this site is
actually differentiated on. What they are good for is a checklist and a crawler
configuration. The system below is ours; the tools contributed about a day of ideas
and one genuinely high-leverage tactic (IndexNow).

---

## 1. `zubair-trabzada/geo-seo-claude`

**What it is.** A Claude Code skill bundle: ~95% markdown prompt files, ~1,700 lines
of Python, 9.3k stars, MIT. Installs slash commands (`/geo audit`, `/geo llmstxt`).
Roughly a third of the repo is agency sales machinery (prospecting, proposals,
white-label PDF reports) — the tool is a lead magnet for a paid community.

**Worth taking:**

- **The AI-crawler tier list.** Genuinely precise, and the distinctions matter:
  `OAI-SearchBot` is ChatGPT *search* and not training; `GPTBot` is training plus
  browsing; `Google-Extended` controls Gemini training and **blocking it does not
  affect Google Search rankings**, which is widely misunderstood. `ClaudeBot` and
  `anthropic-ai` are separate.
- **`Content-Signal`** (IETF draft, contentsignals.org): a robots.txt directive that
  declares downstream *usage* separately from access. `ai-train=no, search=yes,
  ai-retrieval=yes` is an honest, explicit position rather than a claimed one. Best
  fit in the whole repo for how this company wants to behave.
- **Answer-first passage rules.** 50–200 words per extractable passage, first
  sentence stands alone, never open with a pronoun or a conjunction, one idea per
  paragraph, tables for any 3+ item comparison, headings phrased as real questions.
  This is the actual mechanism by which our verified status data gets quoted.
- **Server-rendered JSON-LD.** GPTBot, ClaudeBot and PerplexityBot all have limited
  JS execution. Structured data injected client-side is invisible to them.
- **IndexNow.** ChatGPT search and Copilot both ride Bing's index, and IndexNow is
  near-instant Bing reindexing. See §4 — this is the highest-leverage single item
  across all three tools, for us specifically.
- **`knowsAbout`** on Organization, and `sameAs` pointing only at profiles that exist.

**Refused:**

- **Its schema templates ship fabricated ratings.** `local-business.json` carries
  `"ratingValue": "4.8"` as a *pre-filled value*, not a placeholder, while the
  placeholder convention elsewhere is `YOUR_BUSINESS_NAME`. Copy-pasting one publishes
  a fake aggregate rating in structured data. This is exactly what doc 09 bans, and it
  is also a Google structured-data policy violation.
- **Its report skill mandates invented ROI numbers** ("approximately $X,XXX–$XX,XXX
  per month in additional organic value") and asserts a causal constant with no source.
- **The Brand Authority Score** (20% of its composite) is YouTube 25% + Reddit 25% +
  Wikipedia 20% + LinkedIn 15%. We cannot reach Wikipedia notability, LinkedIn is
  B2B-irrelevant here, and its Reddit advice is astroturf-adjacent. This category
  would score us near zero permanently and tell us nothing. **Do not use its composite
  score as a KPI.** Its "hire a Wikipedia consultant" advice is paid editing, a WP:COI
  problem, and precisely the manufactured authority we refuse. A **Wikidata item** is
  legitimate and free; keep that part.
- **Word-count floors** ("blog post minimum 1,500", "2,000+ for pillar"). Padding
  pressure that fights directly against a terse, honest status page.
- **llms.txt is oversold.** It claims AI systems check it first and that it improves
  citation accuracy. No major provider has confirmed consuming it and Google has
  publicly dismissed it. We publish one anyway (§4) — but as a statement of position,
  not as a ranking lever, and nobody should budget for it.
- Its citability *scoring script* awards 15 points for the regex `\w+\s+is\s+(a|an|the)`,
  which matches almost any English sentence. Use the rubric as an editorial checklist;
  ignore the number.

**Gaps we have to fill ourselves:** zero travel schema (no `TouristTrip`,
`TouristAttraction`, `Event`), zero multilingual GEO, and nothing at all on live or
verified data. Its business-type detector would classify a multi-day guided
pilgrimage as "Local Service".

## 2. `every-app/open-seo`

**What it is.** An open-source Semrush/Ahrefs alternative. 11.4k stars, MIT, five
months old, v0.1.4, and **416 of 448 commits are by one person**. It is not a library:
`package.json` is `private`, nothing is on npm, and the code is Cloudflare-Workers
shaped. Every piece of SEO data comes from **DataForSEO**, a paid third party.

**Worth taking:**

- **The hosted MCP server, $10/month.** ~35 tools: keyword metrics with real India
  location code and both `en` and `hi` language codes, SERP results, site audit, GSC
  and GA4. For a narrow keyword set we need this data a dozen times a quarter.
  Building the plumbing ourselves is weeks of work for data we would still have to buy.
  Self-hosting to save their 28% markup is not worth the operational surface.
- **Its audit issue catalogue** (`src/shared/audit-issues.ts`, MIT) as a *spec* for
  our own CI checks: 25 issue types with thresholds and plain-English explanations.
  Lift the logic, not the files.
- **Its `seo-audit` skill guardrail**, which is almost our positioning word for word:
  *"Verify every finding against the live page HTML by fetching pages yourself. Report
  nothing you have not seen evidence for"*, and missing backlink data means "no
  recorded data", not a penalty.

**Refused / cautions:**

- Docker self-host **ships with authentication disabled** (`AUTH_MODE=local_noauth`),
  and the mode is reportedly broken anyway. Never put a self-hosted instance on the
  public internet.
- Telemetry on by default in self-host (`OPENSEO_TELEMETRY_DISABLED=1` to opt out).
- Known shipped bugs: scheduled rank checks silently never fire; no query-parameter
  handling, producing duplicate-content false positives.
- Rank tracking, backlinks and dashboards duplicate Search Console at our scale.

**The important finding:** its audit has **no hreflang check at all** — zero mentions
of hreflang, JSON-LD or llms.txt in the issue catalogue, despite the crawler
collecting `hreflangTags` and `hasStructuredData` and never reporting on them. For a
bilingual `/en/`–`/hi/` site, hreflang correctness is a top-three technical risk and
this tool will not catch a single error. Its coverage stops exactly where our
differentiator starts.

## 3. `serpapi/awesome-seo-tools`

**What it is.** A README-only awesome list, ~120 tools in 12 sections, 1.1k stars,
maintained by a paid SERP-API vendor. **The commit log is almost entirely "merge PR
from `<vendor>`/add-`<their own tool>`"** — inclusion signals that somebody wanted a
backlink, not that a tool is good. Read it as a directory.

**The shortlist that survives filtering, total cost ₹0/month:**

| Tool | Cost | Why it fits us |
|---|---|---|
| **Google Search Console** | free | The only real source of Hindi and Hinglish query data at our volume. No third-party database has crawl depth on "आदि कैलाश यात्रा". Filter Performance by `/hi/`. |
| **Bing Webmaster Tools** | free | Underrated: Bing's index is a primary retrieval source for **ChatGPT search and Copilot**. Cheapest GEO lever available, and the entry point for IndexNow. |
| **Screaming Frog** | free ≤500 URLs | Our whole site is under 500 URLs, so the free tier is the whole product. **The only tool anywhere that audits hreflang pairs.** |
| **SSR Checker** (crawlably) | free | Diffs server-rendered against hydrated HTML. This is the App Router failure mode: a client component means AI crawlers see an empty shell. |
| **Rich Results Test** + `validator.schema.org` | free | The list contains exactly one structured-data tool. Ours is load-bearing. |
| **Google Keyword Planner** | free | The only free tool with proper India geo + Hindi language targeting. |
| **Google Trends** | free | Not in the list. Shows the Apr–Oct yatra seasonality we should publish against. |
| **SerpBear** | free, self-host | Rank tracking on the VPS we already have, instead of $50–150/mo. |
| **GoAccess** | free | Not in the list. Log analysis on the VPS — our best early signal that GPTBot and PerplexityBot are actually reading us. |
| **Google Business Profile** | free | Not in the list. Our only local asset that matters. |

**Ignore, with reasons:** the entire all-in-one section (Ahrefs ~$129/mo, Semrush
~$140/mo — priced per seat for agencies running 20 clients, and their India crawl
depth on our niche is close to nil, so we would pay for confidently wrong data);
the whole backlink section (we have no backlinks to analyse, and two of its entries
are bulk directory submission and AI outreach automation, i.e. the link spam that
would poison a brand selling verified honesty); 17 of 19 content-optimization tools
(agency-priced brief generators, and the newer half are straight AI-slop generators —
*"fully automated, SEO-optimized blog creation"*). **Using those would be actively
self-destructive: our moat is that three founders have stood at Om Parvat and can name
who verified the road on which date.**

**GEO/AEO:** the list mostly predates the concern. One real find:
[`danishashko/geo-aeo-tracker`](https://github.com/danishashko/geo-aeo-tracker) (MIT),
which tracks brand mentions across ChatGPT, Perplexity, Gemini, Copilot, AI Overviews
and Grok — and is built in Next.js 16 + Tailwind, our exact stack, so it is readable.
Caveat: it needs paid Bright Data. For 20 queries a manual monthly check is more
reliable and free.

**Hindi/India:** the list has **nothing**. Its five local-SEO tools are US citation
services with no Indian directory network — paying for them would be pure waste.

---

## 4. What we are building

Convergent across all three reviews, and none of it depends on buying anything.

### Shipped

- **`app/sitemap.ts`** — every URL carries its `hreflang` pair. `changeFrequency`
  reflects what is actually true (status daily, policies monthly) rather than marking
  everything daily at priority 1.0, which is the oldest tell of an unserious sitemap.
- **`app/robots.ts`** — AI crawlers named and allowed. Private paths disallowed, which
  is not access control (the API is) but stops a token in a shared link becoming an
  indexed page. **Disallows everything while the origin is provisional**, so a preview
  host never enters the index.
- **`lib/site-url.ts`** — one origin resolver. Provisional unless a human asserted it.
- **hreflang + canonical in `buildMetadata`** — derived from decision D11's
  symmetrical prefixes rather than configured, with `x-default` on English.

### Next

- **Server-rendered JSON-LD**: `TouristTrip` for journeys, `Organization` with real
  `sameAs` and `knowsAbout`, `FAQPage`, `BreadcrumbList`, and `dateModified` on the
  status page. Emitted from server components, never client-side.
- **`llms.txt`** — as a statement of position, not a ranking lever.
- **`Content-Signal`** in robots.
- **IndexNow**, pinged from `apps/api` whenever a status row is written. This is the
  highest-leverage item on the page: our differentiator is freshness, ChatGPT and
  Copilot both read Bing's index, and this is the only lever that turns a verified
  status update into near-immediate AI-surface freshness.
- **SEO CI checks** — our own, from OpenSEO's catalogue as a spec, plus the three
  things no tool checks: hreflang reciprocity, JSON-LD validity, and status freshness.

### Never

Fabricated ratings, review counts, traveller counts or awards in markup or on the
page. Generated articles about a route we have walked. Reddit seeding. Paid Wikipedia
editing. Blocking AI crawlers to protect content nobody has found yet.

---

## The measurement trap

Three of these tools want to sell a composite score. Do not adopt one. At zero domain
authority every composite will read near-zero for a year regardless of what we do, and
optimising a number that cannot move is how a team stops doing the thing that works.

The honest early metrics are: **Search Console impressions on the route-status and
permit queries**, **whether GPTBot and PerplexityBot appear in the VPS access logs**,
and **whether a manual monthly check of twenty questions in ChatGPT and Perplexity
ever returns us**. All three are free. None is a vanity number.
