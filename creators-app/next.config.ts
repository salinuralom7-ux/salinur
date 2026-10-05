import type { NextConfig } from "next";

// PREVIEW_EXPORT=1 builds a static copy (out/) for quick previews.
// Normal builds and Vercel ignore it.
const preview = process.env.PREVIEW_EXPORT === "1";

const nextConfig: NextConfig = preview
  ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
  : {};

export default nextConfig;
