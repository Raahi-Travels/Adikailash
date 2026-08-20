/**
 * ============================================================================
 * Feathers: how a photograph leaves its frame.
 * ============================================================================
 *
 * Its own module, and not because it is long. `Scene` renders a real photograph
 * and `PhotoSlot` renders the illustration that stands in for one that has not
 * been shot yet, and the two have to ramp identically or the page reflows its
 * edges the day the picture lands. `Scene` already imports `PhotoSlot`, so the
 * table cannot live in either of them without a cycle.
 */

/**
 * How a photograph leaves the frame.
 *
 * `none` is a hard edge and should only be used where the image is already
 * bounded by something else. `bottom` is the card default, for a picture whose
 * foot meets the section below it. `bottom-right` is the dark-register bleed.
 * `vignette` softens all four edges and suits a picture floating in a band with no
 * ground to meet.
 *
 * `crest` and `crest-right` are the figure feathers, and they ramp the leading
 * edges as well as the foot. An earlier note here said side feathering was a
 * dark-ground technique only, on the theory that a dark rock edge fading to cream
 * passes through mid-grey and reads as a thumbprint. Screenshotting it says
 * otherwise: at an 80% start the ramp is long enough that the transit through grey
 * is never a visible band, and the alternative, which is what shipped, was a hard
 * vertical rule down the side of every figure on a cream page. Judge any change
 * here by looking at /partners and at the homestay figure on the home page, not by
 * reading this paragraph.
 */
export type Feather =
  | "none"
  | "bottom"
  | "bottom-right"
  | "crest"
  | "crest-right"
  | "vignette";

/**
 * Ramp lengths, chosen against rule 1 above rather than by eye.
 *
 * Read `mask-b-from-74%` as "opaque down to 74% of the height, then ramping to
 * nothing at the foot": the ramp is 55% of the box, over 200 real pixels on
 * a 26% ramp at the foot. `mask-r-from-86%` is a 14% ramp across the width.
 *
 * **These are Tailwind's own mask utilities and not an arbitrary
 * `[mask-image:…]` property, and that is not a style preference.** The arbitrary
 * form compiles perfectly when you hand it to the compiler, and is *never
 * generated* from source: the class string contains commas and a `#`, and
 * Tailwind's candidate scanner will not extract it, so the utility silently does
 * not exist, the mask silently does nothing, and every screenshot shows the hard
 * edge you thought you had removed. Found by diffing the served stylesheet, which
 * is the only way it could have been found. Tailwind's own utilities also compose
 * several edges through `mask-composite: intersect` for free.
 */
export const FEATHER: Record<Feather, string> = {
  none: "",
  bottom: "mask-b-from-74%",
  "bottom-right": "mask-b-from-76% mask-r-from-86%",
  /*
   * `crest` is `bottom` with the top and leading edges dissolved as well, for a
   * picture that sits *inside* a band rather than under it.
   *
   * The original set had no top ramp, and the reason was that every feathered
   * picture was assumed to end a section. `PhotoFigure` does not: on /partners and
   * on the homestay figure it sits mid-band with cream above it, so it drew a hard
   * horizontal rule across the page and read as exactly the boxed-off rectangle the
   * feather exists to prevent.
   *
   * 10% of the height at the top, 20% at the bottom, 8% across the leading edge.
   *
   * These were 35 / 45 / 20, and at those lengths `mask-composite: intersect`
   * left only the band between 35% and 55% of the height fully opaque. Four
   * fifths of every figure was ramp, so the photograph read as fog with a strip
   * of picture in it, which is the opposite of the problem the feather was added
   * to solve. A feather is meant to remove the *edge*, not the subject.
   *
   * The scrim compounded it: where a feather reaches the foot, `.scrim-bottom`
   * paints another half-height of page ground over the same pixels, so the
   * bottom was washed twice. Judge any change here on the homestay figure on the
   * home page, at 1440 and at 390, and look at whether you can still read the
   * copper vessels.
   */
  crest: "mask-t-from-90% mask-b-from-80% mask-l-from-92%",
  "crest-right": "mask-t-from-90% mask-b-from-80% mask-r-from-88%",
  vignette: "mask-radial-from-72% mask-radial-to-100%",
};

/** Which feathers reach the bottom edge, and therefore need the scrim. */
export const REACHES_BOTTOM: Record<Feather, boolean> = {
  none: false,
  bottom: true,
  "bottom-right": true,
  crest: true,
  "crest-right": true,
  vignette: false,
};
