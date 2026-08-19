/**
 * The bloom field.
 *
 * **This replaces `AuroraCanvas`.** That was a WebGL context, a `requestAnimationFrame`
 * loop and a permanent battery draw, to produce what two `radial-gradient()` calls
 * render statically, server-side, at no cost. On a phone on mobile data above
 * Dharchula that trade was never worth making.
 *
 * `-inset-[20%]` is required rather than decorative: the gradients have to
 * originate outside the visible box or you get two identifiable circles, which is
 * the 2021-dribbble look this brief bans by name. The test for strength is the
 * same one: **if you can point at the gradient and name it, it is too strong.**
 * The alphas below are at that edge; drop to 0.18 and 0.22 if the founder says he
 * can see blobs.
 *
 * The parent must be `relative isolate overflow-hidden`, or the negative inset
 * leaks a horizontal scrollbar. `<Band>` already is.
 *
 * Register-aware through `--ground`, which each register sets: warm top right and
 * cool bottom left on both, at the alpha that ground can carry.
 */
export function Bloom({
  className = "",
  drift = false,
}: {
  className?: string;
  /**
   * A very slow transform-only drift.
   *
   * Never combined with the static blur below on a large mobile area: pick one.
   * `drift` therefore drops the blur, because a 24px blur filter on a
   * viewport-sized element is the expensive half.
   */
  drift?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -inset-[20%] -z-10 ${drift ? "bloom-drift" : ""} ${className}`}
      style={{
        backgroundImage: "var(--bloom)",
        filter: drift ? undefined : "blur(24px)",
      }}
    />
  );
}
