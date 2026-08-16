import { notFound } from "next/navigation";

import { AuroraCanvas } from "@/components/aurora-canvas";
import { Contours, Grain, MeshGlow, Vignette } from "@/components/backgrounds";

/**
 * Background treatment comparison.
 *
 * Not linked from anywhere and returns 404 in production. It exists so the choice is
 * made by looking rather than by describing, with the same headline and the same
 * status strip under every option, because a treatment that looks good on an empty
 * div often fails behind real text.
 *
 * The cost note on each is the part that matters. Most of this audience is on a
 * mid-range Android phone on mobile data.
 */

export const dynamic = "force-dynamic";

type Specimen = {
  /** Anchor, so each treatment can be linked and compared directly. */
  id: string;
  name: string;
  what: string;
  cost: string;
  verdict?: string;
  layers: React.ReactNode;
};

const SPECIMENS: Specimen[] = [
  {
    id: "flat",
    name: "01 · Flat",
    what: "What ships today: one solid #0b1d2d across every section.",
    cost: "Nothing.",
    verdict:
      "The problem, for reference. At this size it reads as an unstyled div, and it bands visibly on 6-bit phone panels.",
    layers: null,
  },
  {
    id: "grain",
    name: "02 · Grain only",
    what: "An feTurbulence layer at soft-light over the flat navy.",
    cost: "About 300 bytes of inline SVG. No JavaScript, no requests, no paint cost worth measuring.",
    verdict:
      "The highest ratio of improvement to cost on this page. It alone fixes the banding, and it makes the surface feel like paper rather than a screen.",
    layers: <Grain />,
  },
  {
    id: "mesh",
    name: "03 · Mesh glow",
    what: "Three radial gradients anchored off-canvas, in teal and gold under 20% alpha.",
    cost: "One extra element. CSS only.",
    verdict:
      "Gives the page a light source. Watch it on a calibrated screen: the risk is that it starts to look like a generic SaaS gradient, which is the opposite of the brand.",
    layers: <MeshGlow />,
  },
  {
    id: "mesh-grain",
    name: "04 · Mesh + grain",
    what: "Both of the above together.",
    cost: "Same as the two combined. Still no JavaScript.",
    verdict:
      "My recommendation. The grain breaks the gradient up enough that it stops reading as a gradient and starts reading as atmosphere, which is exactly the difference between generic and considered.",
    layers: (
      <>
        <MeshGlow />
        <Grain />
      </>
    ),
  },
  {
    id: "contours",
    name: "05 · Contours",
    what: "Procedural topographic lines at 5%, no asset required.",
    cost: "About 1 KB of inline SVG.",
    verdict:
      "The most brand-specific option: it says survey map without any imagery. Strong on the status and planning pages. Probably too much personality under the hero photograph.",
    layers: (
      <>
        <Contours />
        <Grain opacity={0.35} />
      </>
    ),
  },
  {
    id: "vignette",
    name: "06 · Vignette",
    what: "Edge darkening plus one faint horizon band.",
    cost: "One element, CSS only.",
    verdict:
      "Only removes light, never adds colour, so it cannot clash with a photograph. The safest thing to put under the scene images, and it stacks with anything here.",
    layers: (
      <>
        <Vignette />
        <Grain opacity={0.35} />
      </>
    ),
  },
  {
    id: "shader",
    name: "07 · Animated shader (WebGL)",
    what: "A fragment shader: two drifting fbm noise layers tinted between midnight, teal and a trace of gold.",
    cost: "A WebGL context and a requestAnimationFrame loop per instance. Real battery draw on phones. Honours prefers-reduced-motion and stops when scrolled out of view.",
    verdict:
      "Genuinely beautiful and genuinely the wrong tool here. The page's job is to be believed; a drifting background pulls attention toward the decoration and away from the verified-status strip. Worth seeing before ruling out.",
    layers: (
      <>
        <AuroraCanvas />
        <Grain opacity={0.4} />
      </>
    ),
  },
];

function Specimen({ specimen }: { specimen: Specimen }) {
  return (
    <section id={specimen.id} className="scroll-mt-16 border-t border-tone-line">
      <div className="relative isolate overflow-hidden register-dark px-6 py-16 text-tone-strong">
        {specimen.layers}

        <div className="relative mx-auto max-w-4xl">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">
            {specimen.name}
          </p>
          <h2 className="mt-5 max-w-[22ch] font-serif text-[2.25rem] leading-[1.1] tracking-[-0.02em]">
            Some journeys begin with a plan. Others begin with a calling.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-tone-body">
            Answer the call of Adi Kailash through a carefully guided journey rooted in
            the Himalaya.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-midnight">
              Explore the Journey
            </span>
            <span className="rounded-full px-5 py-2.5 text-sm ring-1 ring-tone-line">
              Speak to a Journey Guide
            </span>
          </div>

          {/* The real trust strip. If a treatment hurts legibility, it shows here first. */}
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-3">
            {[
              ["Route", "Open, not recently verified"],
              ["Permits", "Permit pending"],
              ["Last verified", "8 Aug 2026, 11:28 pm IST"],
            ].map(([label, value]) => (
              <div key={label} className="bg-tone-raised/80 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.1em] text-tone-muted">
                  {label}
                </p>
                <p className="mt-1.5 text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-[15px] leading-relaxed text-ink">{specimen.what}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          <span className="text-ink">Cost. </span>
          {specimen.cost}
        </p>
        {specimen.verdict && (
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-secondary">
            <span className="text-ink">Read. </span>
            {specimen.verdict}
          </p>
        )}
      </div>
    </section>
  );
}

export default function BackgroundLab() {
  // Never reachable in production. This is a working surface, not a page.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main id="main" className="flex-1 bg-snow">
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="font-serif text-3xl text-ink">Background treatments</h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-ink-secondary">
          The same hero and the same status strip under seven treatments, so the choice
          is made by looking. Judge them on a phone as well as here: the flat option
          bands on cheap panels, and the animated one costs battery on exactly the
          devices most of this audience uses.
        </p>
        <p className="mt-3 text-sm text-ink-secondary">
          Development only. This route 404s in production.
        </p>
      </div>

      {SPECIMENS.map((specimen) => (
        <Specimen key={specimen.name} specimen={specimen} />
      ))}
    </main>
  );
}
