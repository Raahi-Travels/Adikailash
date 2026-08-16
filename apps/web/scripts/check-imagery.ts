/**
 * Fails when a synthetic image sits in a slot that claims to show a real place.
 *
 * Run with `bun run check:imagery`.
 *
 * **This used to ban AI imagery outright and that was the wrong rule.** The founders
 * will use real photography where it matters and generated imagery where it does not,
 * which is a reasonable way to run a small business with an eight-week shooting
 * window. A blanket ban just gets switched off, and then nothing is checked at all.
 *
 * Doc 02's actual rule is narrower and worth keeping: "Only original or verified
 * supplier imagery may represent actual stays, vehicles or route conditions." The
 * distinction is not synthetic versus real, it is **claim versus decoration**. A
 * journey card for Adi Kailash is a claim about a mountain somebody will travel to. A
 * texture behind a heading claims nothing.
 *
 * So `DEPICTS_A_REAL_PLACE` lists the slots that make a claim, and those must carry
 * `original`, `supplier_provided` or `licensed_editorial`. Everything else may be
 * anything, as long as it is declared — an undeclared file fails too, because an
 * image nobody wrote a line about is an image nobody decided about.
 *
 * Provenance values mirror `MediaProvenance` in the API, so the same vocabulary
 * describes a file on disk and a row in the database.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCENES_DIR = join(process.cwd(), "public", "scenes");
const MANIFEST = join(SCENES_DIR, "PROVENANCE.txt");

/** Provenance that may stand in for a real, named place. */
const TRUSTWORTHY = new Set(["original", "supplier_provided", "licensed_editorial"]);

const KNOWN = new Set([...TRUSTWORTHY, "illustrative", "ai_generated"]);

/**
 * Slots whose image is read as a photograph *of that place*.
 *
 * A journey card sits under the journey's name; a viewer takes it as the route. The
 * homestay kitchen is doc 05's accommodation-reality promise made visually. The
 * permit image sits beside instructions about a real office.
 *
 * `journeys/default.webp` is deliberately absent: it is the fallback for a journey
 * with no photograph yet, so it is by definition not a picture of anywhere.
 */
const DEPICTS_A_REAL_PLACE = [
  /^hero\.webp$/,
  /^homestay-kitchen\.webp$/,
  /^permits\.webp$/,
  /^journeys\/(?!default\.webp$).+$/,
];

function walk(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return walk(join(dir, entry.name), `${prefix}${entry.name}/`);
    if (entry.name.endsWith(".txt") || entry.name.startsWith(".")) return [];
    return [`${prefix}${entry.name}`];
  });
}

const present = walk(SCENES_DIR);
if (present.length === 0) {
  console.log("No scene images present. Nothing to check.");
  process.exit(0);
}

const declared = new Map<string, string>();
if (existsSync(MANIFEST)) {
  for (const line of readFileSync(MANIFEST, "utf8").split("\n")) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const [file, provenance] = text.split(/\s+/);
    if (file && provenance) declared.set(file, provenance);
  }
}

const undeclared: string[] = [];
const unknown: string[] = [];
const claiming: string[] = [];

for (const file of present) {
  const provenance = declared.get(file);
  if (!provenance) {
    undeclared.push(file);
    continue;
  }
  if (!KNOWN.has(provenance)) {
    unknown.push(`${file} — "${provenance}"`);
    continue;
  }
  const isClaim = DEPICTS_A_REAL_PLACE.some((pattern) => pattern.test(file));
  if (isClaim && !TRUSTWORTHY.has(provenance)) {
    claiming.push(`${file} — ${provenance}`);
  }
}

const failed = undeclared.length + unknown.length + claiming.length > 0;

if (undeclared.length) {
  console.error(`\n${undeclared.length} image(s) not declared in PROVENANCE.txt:\n`);
  for (const f of undeclared) console.error(`  ${f}`);
  console.error("\nAdd a line saying what each one is. An undeclared image is one");
  console.error("nobody decided about.\n");
}

if (unknown.length) {
  console.error(`\n${unknown.length} image(s) with an unrecognised provenance:\n`);
  for (const f of unknown) console.error(`  ${f}`);
  console.error(`\nUse one of: ${[...KNOWN].join(", ")}\n`);
}

if (claiming.length) {
  console.error(
    `\n${claiming.length} image(s) stand in for a real place while being synthetic:\n`,
  );
  for (const f of claiming) console.error(`  ${f}`);
  console.error(
    "\nDoc 02: only original or verified supplier imagery may represent actual" +
      "\nstays, vehicles or route conditions. These sit under the name of a place" +
      "\nsomebody will travel to, so a viewer reads them as that place." +
      "\n\nEither replace them with photographs and update PROVENANCE.txt, or move" +
      "\nthe generated image to a slot that is not making a claim.\n",
  );
}

if (failed) process.exit(1);

const synthetic = [...declared.values()].filter((p) => !TRUSTWORTHY.has(p)).length;
console.log(
  `Imagery provenance holds: ${present.length} image(s) declared, ` +
    `${synthetic} synthetic or illustrative, none standing in for a real place.`,
);
