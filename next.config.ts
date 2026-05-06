import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Tauri — builds to static HTML/JS/CSS in the `out/` directory.
  // This means API Routes and Server Actions will NOT work inside the Tauri binary.
  // Server-side logic lives in the `functions/` directory (Firebase Cloud Functions).
  output: "export",

  // Tauri serves files locally, so the default Next.js image optimizer won't work.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
