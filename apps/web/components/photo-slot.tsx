/**
 * A reserved space for photography that does not exist yet.
 *
 * Deliberately NOT filled with stock or generated imagery. Doc 02 is explicit:
 * "Unrelated Nepal, Tibet or Ladakh imagery labelled as Adi Kailash" and
 * "AI-generated travel images presented as real locations" are both banned, and
 * "generic Himalayan imagery must not substitute for route truth."
 *
 * A placeholder mountain would violate that on the very page whose job is to prove
 * the company tells the truth. So the slot states what belongs here and stays empty
 * until someone walks the route with a camera.
 *
 * Reserves its aspect ratio, so dropping the real image in causes no layout shift.
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
      className={`flex items-end rounded-lg bg-himalayan/60 p-5 ring-1 ring-inset ring-white/10 ${className}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={`Photograph pending: ${brief}`}
    >
      <p className="max-w-[34ch] text-sm leading-relaxed text-ink-inverse/45">
        <span className="block text-xs uppercase tracking-[0.14em] text-ink-inverse/35">
          Photograph pending
        </span>
        <span className="mt-1.5 block">{brief}</span>
      </p>
    </div>
  );
}
