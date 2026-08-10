/**
 * Fails while any provisional (AI-generated) scene image is still in place.
 *
 * Run before the first public deploy: `bun run check:imagery`.
 *
 * The placeholders are fine while the site is behind Vercel Authentication and only
 * the team can see it. They are not fine the day it opens, because doc 02 bans
 * "AI-generated travel images presented as real locations" and the entire site is an
 * argument that we tell the truth about this road.
 *
 * A scene counts as real once its file is listed in `public/scenes/REAL.txt`, one
 * filename per line. That file is the record of which photographs have actually been
 * taken, and it is deliberately manual: someone has to assert it.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// `process.cwd()` rather than `import.meta.dir`: the script runs from the package
// root via `bun run`, and Next's type check does not know about Bun's ImportMeta.
const SCENES_DIR = join(process.cwd(), "public", "scenes");
const MANIFEST = join(SCENES_DIR, "REAL.txt");

function walk(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return walk(join(dir, entry.name), `${prefix}${entry.name}/`);
    if (entry.name === "REAL.txt" || entry.name.startsWith(".")) return [];
    return [`${prefix}${entry.name}`];
  });
}

const present = walk(SCENES_DIR);

if (present.length === 0) {
  console.log("No scene images present. Nothing to check.");
  process.exit(0);
}

const confirmed = new Set(
  existsSync(MANIFEST)
    ? readFileSync(MANIFEST, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    : [],
);

const provisional = present.filter((file) => !confirmed.has(file));

if (provisional.length === 0) {
  console.log(`All ${present.length} scene images are confirmed as real photography.`);
  process.exit(0);
}

console.error(
  `\n${provisional.length} of ${present.length} scene images are still AI placeholders:\n`,
);
for (const file of provisional) console.error(`  public/scenes/${file}`);
console.error(
  "\nReplace each with real photography, then add its filename to" +
    "\npublic/scenes/REAL.txt to record that it was actually taken." +
    "\n\nThese must not go public: the site's credibility rests on the route" +
    "\ninformation being true, and a synthetic mountain undoes that argument.\n",
);
process.exit(1);
