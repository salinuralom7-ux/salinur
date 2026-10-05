import type { NextConfig } from "next";

// PREVIEW_EXPORT=1 builds a static copy (out/) for quick previews.
// Normal builds and Vercel ignore it.
const preview = process.env.PREVIEW_EXPORT === "1";

// Profile photos are served from Supabase Storage; let next/image optimise them.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  images: {
    unoptimized: preview,
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  ...(preview ? { output: "export", trailingSlash: true } : {}),
};

export default nextConfig;
