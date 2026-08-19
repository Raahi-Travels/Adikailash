import { FEATHER, type Feather } from "@/components/feather";
import { SceneArt } from "@/components/scene-art";

/**
 * A slot whose photograph does not exist yet.
 *
 * Renders procedural ridge illustration rather than a grey box, so the page looks
 * designed while still being honest. Doc 02 bans "AI-generated travel images
 * presented as real locations", and flat two-tone vector ridges are not that: nobody
 * mistakes them for a photograph, and the caption says plainly what is outstanding.
 *
 * What still never happens here is a synthetic image of a real place. Adi Kailash,
 * Om Parvat, the homestays and the road come from the field trip or they do not
 * appear at all. See `lib/imagery.ts`.
 *
 * **It wears the same edge language as a real photograph**, which is the point of
 * this version: the empty state used to be the only rounded, ringed rectangle on a
 * page of feathered imagery, so the missing picture was the most conspicuous object
 * on the screen. The ring and the 8px radius are gone and the illustration feathers
 * out exactly as a photograph would.
 *
 * **The caption never fades.** The mask is on the inner art wrapper, never on the
 * root: "Photograph pending" is the honesty mechanism, and a mask that dissolved it
 * would quietly remove the one sentence this component exists to say.
 *
 * Reserves its aspect ratio, so dropping the real photograph in causes no layout
 * shift.
 */
export function PhotoSlot({
  brief,
  ratio = "4/3",
  className = "",
  feather = "bottom",
  radius = "none",
}: {
  brief: string;
  ratio?: string;
  className?: string;
  /** Matches the `Scene` prop of the same name, so a slot and a photograph swap cleanly. */
  feather?: Feather;
  radius?: "none" | "top" | "frame";
}) {
  // Tailwind's own mask utilities, never an arbitrary `[mask-image:…]`: the
  // arbitrary form compiles but is never *generated*, because the candidate
  // scanner will not extract a class string containing commas and a `#`. See the
  // note in `components/scene.tsx`.
  // The slot stands in for a photograph, so it borrows the same ramps rather than
  // reimplementing a subset of them: a `crest` slot that feathered only its foot
  // would jump when the real picture arrived.
  const mask = FEATHER[feather];

  const rounding =
    radius === "top" ? "rounded-t-frame" : radius === "frame" ? "rounded-frame" : "";

  return (
    <div
      className={`relative flex items-end overflow-hidden ${rounding} ${className}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={`Illustration. Photograph pending: ${brief}`}
    >
      {/* Masked, and holding nothing but the artwork. */}
      <div aria-hidden className={`absolute inset-0 ${mask}`}>
        <SceneArt seed={brief} />
      </div>

      {/* Sibling of the mask, resolving through the register's own ground so the
          caption sits on navy on a dark page and on snow on a light one. */}
      <div aria-hidden className="scrim-bottom absolute inset-x-0 bottom-0 h-3/5" />

      <p className="type-meta relative max-w-[38ch] p-5 text-tone-body">
        <span className="block text-tone-muted">Photograph pending</span>
        <span className="mt-1.5 block">{brief}</span>
      </p>
    </div>
  );
}
