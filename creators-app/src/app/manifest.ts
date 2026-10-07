import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/**
 * Web app manifest. Makes the site installable, and is what the Android
 * (Trusted Web Activity) app is generated from.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${site.name}: find local influencers`,
    short_name: site.name,
    description: site.tagline,
    start_url: "/?src=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B10",
    theme_color: "#0B0B10",
    categories: ["business", "social", "lifestyle"],
    lang: "en-IN",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Find influencers", short_name: "Find", url: "/search?src=app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Get listed", short_name: "Get listed", url: "/join?src=app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
