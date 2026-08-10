"use client";

import { useEffect, useRef } from "react";

/**
 * A real fragment shader, for comparison against the CSS options.
 *
 * Included so the animated route can be judged rather than imagined. Read the cost
 * before choosing it:
 *
 *   - a WebGL context and a rAF loop per instance, on the GPU but still waking the
 *     main thread every frame
 *   - measurable battery draw on phones, which is most of this audience
 *   - nothing renders if the context fails, so it can never be the only thing
 *     carrying a section
 *
 * Mitigations that are non-negotiable if this ships: it honours
 * `prefers-reduced-motion` by drawing one static frame, stops when scrolled out of
 * view, and caps device pixel ratio at 1.5 because a retina phone rendering noise at
 * 3x is pure waste.
 *
 * My own view is that this is the wrong tool for this brand. Doc 02 asks for
 * restraint, and a drifting background competes with the one thing the page is meant
 * to do, which is be believed. But it should be a decision, not an omission.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;

// Value noise. Cheap, and smooth enough at this scale that the lack of gradient
// noise is invisible once the grain layer goes on top.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 q = vec2(uv.x * (res.x / res.y), uv.y);

  // Two layers drifting at different speeds and directions, which is what stops it
  // reading as a single sliding texture.
  float n1 = fbm(q * 1.6 + vec2(t * 0.012, t * 0.006));
  float n2 = fbm(q * 2.9 - vec2(t * 0.008, t * 0.015));
  float n = mix(n1, n2, 0.45);

  vec3 midnight  = vec3(0.043, 0.114, 0.176);
  vec3 himalayan = vec3(0.106, 0.149, 0.220);
  vec3 teal      = vec3(0.176, 0.365, 0.373);
  vec3 gold      = vec3(0.784, 0.604, 0.306);

  vec3 col = mix(midnight, himalayan, smoothstep(0.35, 0.75, n));
  // Teal only in the upper half, gold only as a trace. Both stay under the
  // "guide the eye rather than coat the interface" rule.
  col = mix(col, teal, smoothstep(0.62, 0.95, n) * 0.22 * (1.0 - uv.y));
  col = mix(col, gold, smoothstep(0.80, 1.0, n1) * 0.06);

  // Vignette, so the edges never brighten past the surrounding page.
  float d = distance(uv, vec2(0.5, 0.45));
  col *= 1.0 - smoothstep(0.35, 0.95, d) * 0.55;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** A silent WebGL failure is indistinguishable from "the design looks flat". Say why. */
function bail(reason: string) {
  if (process.env.NODE_ENV !== "production") console.warn("[aurora]", reason);
  return null;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return bail("could not create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return bail(`shader failed to compile: ${log}`);
  }
  return shader;
}

export function AuroraCanvas({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      // The frame is never read back or composited over, so let the driver drop it.
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      bail("no webgl context");
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) {
      bail("could not create program");
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      bail(`link failed: ${gl.getProgramInfoLog(program)}`);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "res");
    const uTime = gl.getUniformLocation(program, "t");

    // 1.5 is the point past which more pixels of low-frequency noise buy nothing.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      if (!canvas || !gl) return;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let start = performance.now();
    let visible = true;

    function draw(now: number) {
      // A context can be lost at any time (tab backgrounded, GPU reset). Stop rather
      // than burn frames on no-op GL calls.
      if (gl!.isContextLost()) {
        bail("context lost, stopping");
        return;
      }
      resize();
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (!reduced && visible) frame = requestAnimationFrame(draw);
    }

    // Off-screen sections stop rendering entirely. Without this, every instance on a
    // long page animates forever.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduced) {
          start = performance.now() - (start ? performance.now() - start : 0);
          frame = requestAnimationFrame(draw);
        } else {
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: "100px" },
    );
    io.observe(canvas);

    frame = requestAnimationFrame(draw);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      /*
        Deliberately NOT calling `WEBGL_lose_context.loseContext()` here.

        It looks like good hygiene and is the opposite. Losing a context is
        permanent for that canvas element, and React runs effects twice in
        development: mount, clean up, mount again. The second mount then gets the
        same dead context back from `getContext`, every GL call silently no-ops, and
        the canvas stays blank with nothing in the console. That is exactly how this
        component failed the first time it ran.

        The browser reclaims the context when the canvas is collected. Stopping the
        loop is the only cleanup this needs.
      */
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    />
  );
}
