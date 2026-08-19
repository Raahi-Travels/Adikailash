import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  images: {
    /**
     * Wider rungs than the default ladder.
     *
     * Every cover-cropped image on this site was being served between 1.19x and
     * 1.80x too small, because `sizes` describes the *box* while `object-cover`
     * renders the picture wider than its box. Fixing `sizes` only helps if there
     * is a candidate large enough to pick, and the default set tops out too low
     * for a full-bleed hero on a 2x desktop.
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1400, 1600, 1920, 2048, 3840],
    formats: ["image/avif", "image/webp"],

    /**
     * **Next 16 returns HTTP 400 for a quality that is not on this list**, rather
     * than falling back to the nearest one. A `<Image quality={82}>` with 82
     * missing here makes the image vanish at request time while the build stays
     * green and every test passes. List it or do not use it.
     */
    qualities: [50, 68, 75, 82],
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
