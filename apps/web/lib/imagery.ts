import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Scene imagery.
 *
 * These are **provisional, AI-generated** images standing in until the field trip
 * produces real photography. That is a deliberate decision for the private preview,
 * not an accident, and two things follow from it.
 *
 * **They must be replaceable without touching code.** A slot resolves by filename, so
 * dropping `public/scenes/hero.jpg` in makes it appear and deleting it makes the slot
 * fall back to the honest "photograph pending" panel. When the real photographs
 * arrive they overwrite the same filenames and nothing else changes.
 *
 * **They must not reach the public silently.** Doc 02 bans "AI-generated travel
 * images presented as real locations", and that rule is right: the site's whole
 * argument is that we tell the truth about this road. So every provisional scene is
 * marked `data-provisional` in the DOM, shows a corner marker in development, and
 * `bun run check:imagery` fails while any remain. The pre-launch checklist in
 * docs/DEPLOY.md runs it.
 *
 * The site is behind Vercel Authentication today, so nobody outside the team can see
 * these. That is the window in which this is fine.
 */

export type SceneKey =
  | "hero"
  | "homestay-kitchen"
  | "permits"
  | "departures"
  | "journeys/adi-kailash-om-parvat"
  | "journeys/adi-kailash-om-parvat-detail"
  | "journeys/kumaon-spiritual-circuit"
  | "journeys/kumaon-spiritual-circuit-detail"
  | "journeys/homestay-immersion"
  | "journeys/homestay-immersion-detail"
  | "journeys/default";

export type Scene = {
  /**
   * What the image shows, for screen readers.
   *
   * Describes the image, never asserts a location. "A high Himalayan range at first
   * light", not "Om Parvat at first light" — because it is not Om Parvat, and alt
   * text is where that lie would be least visible and most damaging.
   *
   * A sighted visitor sees an unlabelled photographic image, so this gives a screen
   * reader user the same information rather than more or less of it. What records
   * these as generated is `data-provisional`, the dev marker, and the launch gate.
   */
  alt: string;
  /** CSS aspect ratio. Reserved even when the file is missing, so no layout shift. */
  ratio: string;
  /** Shown in the empty state, and doubles as the shot list for the field trip. */
  brief: string;
  /** True for above-the-fold images, which skip lazy loading. */
  priority?: boolean;
};

export const SCENES: Record<SceneKey, Scene> = {
  hero: {
    alt: "A high Himalayan range at first light, ridge lines receding into cold haze",
    ratio: "21/9",
    brief:
      "The first sight of the range on the drive up, shot on the field trip at the hour it actually looks like this.",
    priority: true,
  },
  "homestay-kitchen": {
    alt: "A traditional Kumaoni village kitchen, firelight on copper and brass vessels",
    ratio: "5/4",
    brief:
      "A host family's kitchen in a Kumaon village, shot on the September field trip. Original photography only, with the household's recorded consent.",
  },
  departures: {
    alt: "A mountain road winding through a valley in low light",
    ratio: "21/9",
    brief:
      "The road on a departure morning, so the calendar is attached to a place rather than a spreadsheet.",
  },
  permits: {
    alt: "A barrier across a narrow mountain road beside a small checkpost hut",
    ratio: "3/2",
    brief:
      "The inner-line checkpost as it actually looks, so people know what to expect before they arrive.",
  },

  "journeys/adi-kailash-om-parvat": {
    alt: "A thin road cut across a vast rock face above a shadowed valley",
    ratio: "3/2",
    brief: "Original photography of the Adi Kailash and Om Parvat route.",
  },
  "journeys/adi-kailash-om-parvat-detail": {
    alt: "A high glacial valley above the treeline, a braided stream on the valley floor",
    ratio: "4/3",
    brief: "Original photography of the Adi Kailash and Om Parvat route.",
  },
  "journeys/kumaon-spiritual-circuit": {
    alt: "Weathered stone temple spires among tall deodar cedars in low morning sun",
    ratio: "3/2",
    brief: "Original photography of the Kumaon circuit.",
  },
  "journeys/kumaon-spiritual-circuit-detail": {
    alt: "A stone temple courtyard at dawn, mist filling the valley below",
    ratio: "4/3",
    brief: "Original photography of the Kumaon circuit.",
  },
  "journeys/homestay-immersion": {
    alt: "Slate-roofed houses on a terraced hillside, forested ridges behind",
    ratio: "3/2",
    brief: "Original photography of the homestay villages, with consent.",
  },
  "journeys/homestay-immersion-detail": {
    alt: "The stone courtyard of a village house, copper vessels drying on a low wall",
    ratio: "4/3",
    brief: "Original photography of the homestay villages, with consent.",
  },
  "journeys/default": {
    alt: "Layered Himalayan ridges receding into blue haze at sunrise",
    ratio: "3/2",
    brief: "Original photography of this route, taken by the team.",
  },
};

/** Extensions tried in order. AVIF and WebP first, so a better file wins if present. */
const EXTENSIONS = ["avif", "webp", "jpg", "jpeg", "png"] as const;

/**
 * The public path for a scene, or null when no file has been added yet.
 *
 * Server-only: it touches the filesystem. Every caller is a server component.
 */
export function sceneSrc(key: SceneKey): string | null {
  const base = join(process.cwd(), "public", "scenes");
  for (const ext of EXTENSIONS) {
    if (existsSync(join(base, `${key}.${ext}`))) return `/scenes/${key}.${ext}`;
  }
  return null;
}

/**
 * The scene for a journey, falling back to the generic one.
 *
 * A new journey added in the admin therefore gets sensible imagery immediately
 * rather than a hole, and someone can add a bespoke file later by filename alone.
 */
export function journeyScene(
  slug: string,
  variant: "card" | "detail" = "card",
): { key: SceneKey; scene: Scene } {
  const wanted = (
    variant === "detail" ? `journeys/${slug}-detail` : `journeys/${slug}`
  ) as SceneKey;

  if (wanted in SCENES) return { key: wanted, scene: SCENES[wanted] };
  return { key: "journeys/default", scene: SCENES["journeys/default"] };
}
