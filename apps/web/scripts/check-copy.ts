/**
 * Fails when user-visible copy contains an em-dash, or claims we cannot support.
 *
 * Run with `bun run check:copy`.
 *
 * **The em-dash rule is about the reader, not about style.** It is the single most
 * reliable signal that a page was written by a language model rather than by the
 * people whose business it is, and this brand's whole proposition is that a real
 * family in Pithoragarh is behind it. One em-dash does not give that away; forty
 * across a site does. Comments are exempt, because nobody reads them on the page.
 *
 * **The claims rule exists because of what nearly shipped.** The redesign mockups
 * came back carrying "2,300+ travellers", "Trustpilot 4.8/5", "Since 2010" and a
 * "98% safety record", for a business that has not yet run a departure. They looked
 * completely at home. On a site whose entire argument is that we tell the truth
 * about a road at 4,500 m, invented social proof is not a small thing, and it is
 * exactly the kind of copy that arrives by being pasted from a comp.
 *
 * The safety claim matters most: there is no hospital anywhere above Dharchula, and
 * a percentage next to the word "safety" is a promise nobody can keep.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOTS = ["app", "components", "lib", "messages"];

/** Em-dash and en-dash. The only permitted dash in copy is the plain hyphen. */
const DASHES = /[—–]/;

/**
 * Claims that need a verifiable source before they can appear.
 *
 * Written as patterns rather than exact strings because the failure mode is a
 * plausible variant, not a repeat: "25,000+ travellers" and "10,000 happy pilgrims"
 * are the same problem.
 */
const UNSUPPORTED_CLAIMS: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: /\b[\d,]+\s*\+?\s*(happy\s+)?(travellers?|travelers?|pilgrims?|customers?)\b/i,
    why: "a traveller count, when no departure has run yet",
  },
  {
    // Only when the platform is being cited as proof. An admin dropdown that
    // records which platform a review arrived on is the opposite: it is us
    // tracking somebody else's rating, not publishing one.
    pattern: /\b(rated|rating|reviews?|stars?)\b[^\n]{0,30}\b(trustpilot|tripadvisor|google)\b|\b(trustpilot|tripadvisor)\b[^\n]{0,20}\b(rated|rating|reviews?|\d(\.\d)?\s*\/\s*5)/i,
    why: "a review platform cited as proof, with no listing behind it",
  },
  {
    // A decimal is required. `\d/5` alone matched `h-2/5` in a Tailwind class,
    // which is a fraction of a container height and not a review score.
    pattern: /\b\d\.\d\s*\/\s*5\b|\brated\s+\d(\.\d)?\s*(\/|out of|stars?)/i,
    why: "a star rating, with no reviews behind it",
  },
  {
    pattern: /\bsince\s+(19|20)\d{2}\b/i,
    why: "a founding year that predates the company",
  },
  {
    pattern: /\b\d+\s*%\s*(safety|success|satisfaction)\b/i,
    why: "a safety or success percentage, which nobody can stand behind on this route",
  },
  {
    pattern: /\b\d+\+?\s*years?\s+of\s+experience\b/i,
    why: "a years-in-business claim",
  },
  {
    // Negations are excluded, and the exclusion is the point: doc 09's own
    // disclaimer is the sentence "We do not guarantee darshan, weather,
    // visibility or route access", which a naive pattern flags as the very thing
    // it exists to prevent. A check that fires on the disclaimer teaches people to
    // switch the check off.
    pattern:
      /(?<!\b(not|never|cannot|can't|don't|doesn't|won't)\s)\bguarantee(d|s)?\s+(darshan|weather|visibility|clear\s+views?|views?|route\s+access)\b/i,
    why: "a guarantee of something on a mountain (doc 09 forbids exactly this)",
  },
];

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out = out.concat(walk(path));
      continue;
    }
    if ([".tsx", ".ts", ".json"].includes(extname(path))) out.push(path);
  }
  return out;
}

/** Comments are not copy. A reader never sees them, so they are out of scope. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const dashHits: string[] = [];
const claimHits: string[] = [];

for (const root of ROOTS) {
  let files: string[];
  try {
    files = walk(root);
  } catch {
    continue;
  }

  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const body = file.endsWith(".json") ? raw : stripComments(raw);

    body.split("\n").forEach((line, index) => {
      if (DASHES.test(line)) {
        dashHits.push(`${file}:${index + 1}  ${line.trim().slice(0, 90)}`);
      }
      for (const { pattern, why } of UNSUPPORTED_CLAIMS) {
        if (pattern.test(line)) {
          claimHits.push(`${file}:${index + 1}  ${why}\n      ${line.trim().slice(0, 90)}`);
        }
      }
    });
  }
}

let failed = false;

if (dashHits.length) {
  failed = true;
  console.error(`\n${dashHits.length} em-dash or en-dash in user-visible copy:\n`);
  for (const hit of dashHits) console.error(`  ${hit}`);
  console.error(
    "\nRestructure rather than swapping in a hyphen: two sentences with a full" +
      "\nstop, a comma, a colon, or parentheses. Line numbers are approximate" +
      "\nbecause comments are stripped before matching.\n",
  );
}

if (claimHits.length) {
  failed = true;
  console.error(`\n${claimHits.length} unsupported claim(s):\n`);
  for (const hit of claimHits) console.error(`  ${hit}\n`);
  console.error(
    "Each of these needs something real behind it before it can be published." +
      "\nThe redesign comps arrived carrying every one of them for a business that" +
      "\nhas not run its first departure. If a claim is now genuinely true, add the" +
      "\nsource and narrow the pattern in this file rather than deleting the rule.\n",
  );
}

if (failed) process.exit(1);

console.log(
  "Copy holds: no em-dashes in visible text, no unsupported claims.",
);
