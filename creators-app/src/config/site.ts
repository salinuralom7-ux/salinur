import { PLANS } from "@/lib/pricing";

/**
 * Single source of truth for brand + product constants.
 *
 * The brand name is a placeholder. To rename the product, change `name`
 * (and `url` once you have a domain) — every page, title and legal text
 * reads from here.
 */
export const site = {
  name: "CreatorCity",
  tagline: "India's marketplace where local businesses discover and book Instagram creators near them.",
  shortTagline: "Your city's creators, one scroll away.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contactEmail: "hello@example.com", // TODO: replace with your support email
  /** Monthly creator price in rupees. Plans (monthly ₹99 / yearly ₹594) live in src/lib/pricing.ts. */
  creatorPriceInr: PLANS.monthly.priceInr,
} as const;

/** Niches a creator can pick (max 3). `slug` is used in SEO URLs like /creators/guwahati/food. */
export const NICHES = [
  { slug: "food", label: "Food", emoji: "🍜" },
  { slug: "fashion", label: "Fashion", emoji: "👗" },
  { slug: "beauty", label: "Beauty", emoji: "💄" },
  { slug: "fitness", label: "Fitness", emoji: "💪" },
  { slug: "tech", label: "Tech", emoji: "📱" },
  { slug: "travel", label: "Travel", emoji: "✈️" },
  { slug: "education", label: "Education", emoji: "📚" },
  { slug: "comedy", label: "Comedy", emoji: "😂" },
  { slug: "lifestyle", label: "Lifestyle", emoji: "✨" },
  { slug: "local-business", label: "Local Business", emoji: "🏪" },
] as const;

export type NicheSlug = (typeof NICHES)[number]["slug"];

/** Cities shown on the landing page grid. The full searchable list lives in `src/config/cities.ts`. */
export const FEATURED_CITY_SLUGS = [
  "guwahati",
  "mumbai",
  "delhi",
  "bengaluru",
  "kolkata",
  "pune",
  "hyderabad",
  "chennai",
  "jaipur",
  "ahmedabad",
  "lucknow",
  "shillong",
] as const;
