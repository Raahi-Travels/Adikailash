"use client";

import { useEffect, useRef } from "react";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

/**
 * A drifting field of topographic contour lines behind the hero.
 *
 * The motif is the one visual device that belongs to this brand specifically. Every
 * Himalayan operator has a summit photograph; a contour survey is what somebody who
 * actually knows the ground looks at, and it is the same language as the elevation
 * profile further down the page. It reads as the map under the photograph.
 *
 * **Why a shader rather than geometry.** The lines are iso-contours of a fractal
 * height field computed per pixel, so the whole effect is one full-screen quad and a
 * single draw call. A displaced mesh with a wireframe would need tens of thousands
 * of vertices to get lines this fine, and this has to run on a mid-range Android
 * phone on a hillside.
 *
 * **It is an enhancement, never a dependency.** No text, no control and no
 * information sits on this canvas. If WebGL is missing, the context is lost, or the
 * script never arrives, the hero is a photograph and a headline on navy, which is
 * how it renders on the server anyway.
 *
 * Motion is deliberately absent from this file. Three.js drives its own frame loop
 * and Motion drives React's; keeping them in separate components stops the two
 * scheduling against each other. Scroll is sampled inside the existing frame loop
 * rather than through a scroll listener, which is both cheaper and the only
 * approach that does not fire on every scroll event.
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uScroll;
  uniform float uAspect;
  uniform vec3  uColour;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Five octaves. Four looks like fog, six costs frames for detail that sits below
  // the line width anyway.
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vec2(vUv.x * uAspect, vUv.y) * 3.2;

    // Parallax. The field travels slower than the page, so it sits behind the
    // photograph rather than sliding across it.
    p.y += uScroll * 0.45;

    float h = fbm(p + vec2(uTime * 0.010, uTime * 0.004));

    // Iso-contours: bands of constant height. fwidth keeps the line one pixel wide
    // wherever the gradient is steep, which is what stops the dense areas from
    // filling in as a solid mass.
    float bands = h * 15.0;
    float d = abs(fract(bands) - 0.5);
    float w = fwidth(bands);
    float line = 1.0 - smoothstep(0.0, w * 1.4, d - w * 0.5);

    // Fade out towards the top so the headline never sits on texture, and pull the
    // edges down so the field has no visible boundary.
    // Present only in the lower third and fading out well before the headline.
    float vertical = smoothstep(0.0, 0.34, 1.0 - vUv.y) * smoothstep(0.72, 0.42, 1.0 - vUv.y);
    float edges = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, 1.0 - vUv.x);

    // 0.42 read as wallpaper: the contours were the loudest thing in the hero and
    // the photograph behind them looked like a texture. This is a watermark under a
    // picture, not a pattern over one.
    float alpha = line * vertical * edges * 0.13;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

export function TerrainField({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      // No WebGL. The hero is complete without this.
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new PlaneGeometry(2, 2);

    // Read the token rather than hardcoding, so the contour colour stays tied to the
    // palette and a change in globals.css reaches the canvas too.
    const gold =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-gold")
        .trim() || "#c89a4e";
    const rgb = hexToRgb(gold);

    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uAspect: { value: 1 },
        uColour: { value: rgb },
      },
    });

    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    const size = new Vector2();
    function resize() {
      const rect = mount!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      size.set(rect.width, rect.height);
      renderer.setSize(rect.width, rect.height, false);
      material.uniforms.uAspect.value = rect.width / rect.height;
    }
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    // Pause when scrolled past. A canvas repainting behind the fold is pure battery
    // cost, and this page is read on mobile data at altitude.
    let visible = true;
    const visibility = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !reduced) frame = requestAnimationFrame(tick);
      },
      { threshold: 0 },
    );
    visibility.observe(mount);

    let frame = 0;
    const started = performance.now();

    function tick(now: number) {
      if (!visible) return;
      material.uniforms.uTime.value = (now - started) / 1000;
      // Sampled here rather than through a scroll listener: one read per frame that
      // is already scheduled, instead of a handler firing on every scroll event.
      material.uniforms.uScroll.value = window.scrollY / window.innerHeight;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    }

    if (reduced) {
      // One frame, held. The texture is part of the composition; only the drift is
      // motion, and the drift is what a reduced-motion preference is asking about.
      renderer.render(scene, camera);
    } else {
      frame = requestAnimationFrame(tick);
    }

    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    />
  );
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return {
    x: ((n >> 16) & 255) / 255,
    y: ((n >> 8) & 255) / 255,
    z: (n & 255) / 255,
  };
}
