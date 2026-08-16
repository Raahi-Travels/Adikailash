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
 * Reserves its aspect ratio, so dropping the real photograph in causes no layout
 * shift.
 */
export function PhotoSlot({
  brief,
  ratio = "4/3",
  className = "",
}: {
  brief: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-lg ring-1 ring-inset ring-tone-line ${className}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={`Illustration. Photograph pending: ${brief}`}
    >
      <div className="absolute inset-0">
        <SceneArt seed={brief} />
      </div>

      {/* Scrim only behind the caption, so the ridge line stays readable above it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-midnight to-transparent"
      />

      <p className="relative max-w-[34ch] p-5 text-sm leading-relaxed text-tone-muted">
        <span className="block text-xs uppercase tracking-[0.14em] text-tone-muted">
          Photograph pending
        </span>
        <span className="mt-1.5 block">{brief}</span>
      </p>
    </div>
  );
}
