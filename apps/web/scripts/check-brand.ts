/**
 * Fails if any brand value has been typed into a source file.
 *
 * Run with `bun run check:brand`.
 *
 * Decision D4 says every brand value lives in one config module and no brand string
 * appears in any page, template, table name, route or env var. Doc 03 makes it a
 * launch acceptance scenario: the working name "The Sacred North" is provisional
 * (D3), and the whole point of D4 is that replacing it is a config edit rather than
 * a migration.
 *
 * **That claim had never been checked.** It was true when written and stayed true by
 * habit, which is not the same thing — the first run of this script found the brand
 * name hardcoded in `apps/api/src/api/llm.py`, added a few hours earlier by somebody
 * (me) who had read D4 and still typed it.
 *
 * The values are read from the config rather than hardcoded here, so this keeps
 * working the day the brand changes. A check that needs updating when the thing it
 * checks changes is a check that gets deleted.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { brand } from "../lib/brand/config";
import { isSettled, valueOf } from "../lib/brand/types";

const ROOT = join(process.cwd(), "..", "..");

/** Where the brand config itself lives, and is allowed to name the brand. */
const ALLOWED = [
  "apps/web/lib/brand/config.ts",
  "apps/web/scripts/check-brand.ts",
  "docs/",
  ".git/",
  "node_modules/",
  ".next/",
];

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".css", ".json", ".sql"]);

/**
 * Values worth searching for.
 *
 * Only settled, distinctive ones. A placeholder like "—" or a two-letter locale
 * would match everything, and an unsettled value is not a brand string yet.
 */
function brandStrings(): { key: string; value: string }[] {
  const candidates: [string, unknown][] = [
    ["identity.name", brand.identity.name],
    ["web.seoTitleSuffix", brand.web.seoTitleSuffix],
    ["contact.whatsappDisplayName", brand.contact.whatsappDisplayName],
    ["legal.copyrightHolder", brand.legal.copyrightHolder],
    ["web.domain", brand.web.domain],
  ];

  const seen = new Set<string>();
  const out: { key: string; value: string }[] = [];
  for (const [key, configurable] of candidates) {
    const value = valueOf(configurable as Parameters<typeof valueOf>[0]);
    // Unsettled values are placeholders, not brand strings. Short ones would match
    // half the codebase and turn this into noise nobody reads.
    if (
      typeof value !== "string" ||
      value.length < 6 ||
      !isSettled(configurable as Parameters<typeof isSettled>[0]) ||
      seen.has(value)
    ) {
      continue;
    }
    seen.add(value);
    out.push({ key, value });
  }
  return out;
}

function walk(dir: string): string[] {
  let files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full).replaceAll("\\", "/");
    if (ALLOWED.some((a) => rel === a || rel.startsWith(a))) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const strings = brandStrings();
if (strings.length === 0) {
  console.log("No settled brand strings to check yet.");
  process.exit(0);
}

const hits: string[] = [];
for (const file of walk(join(ROOT, "apps"))) {
  let contents: string;
  try {
    if (statSync(file).size > 2_000_000) continue;
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { key, value } of strings) {
    if (!contents.includes(value)) continue;
    const line = contents.split("\n").findIndex((l) => l.includes(value)) + 1;
    hits.push(`${relative(ROOT, file)}:${line} — ${key} = "${value}"`);
  }
}

if (hits.length > 0) {
  console.error(
    `\nD4 says every brand value lives in the brand config and nowhere else.\n` +
      `${hits.length} place(s) name the brand directly:\n`,
  );
  for (const hit of hits) console.error(`  ${hit}`);
  console.error(
    `\nRead the value from the brand config instead. The working name is provisional\n` +
      `(D3), and D4 exists so changing it is a config edit rather than a migration.\n`,
  );
  process.exit(1);
}

console.log(
  `Brand portability holds: ${strings.length} brand value(s) checked across apps/, ` +
    `none hardcoded outside the config.`,
);
