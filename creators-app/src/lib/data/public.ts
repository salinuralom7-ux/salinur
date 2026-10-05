import "server-only";
import type { CreatorCardData } from "@/types/creator";

/**
 * Public, read-only data for marketing pages.
 *
 * Rule: never show invented numbers. Until the database is connected
 * (step 2), these return "no data" and the UI renders its empty states.
 */

export function isDatabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export type LandingStats = { creatorsLive: number; citiesLive: number };

/** Live creator + city counts, or null when there is no database yet. */
export async function getLandingStats(): Promise<LandingStats | null> {
  if (!isDatabaseConfigured()) return null;
  // Wired up in step 2 (Supabase schema).
  return null;
}

/** Verified, live creators for the landing carousel. */
export async function getFeaturedCreators(): Promise<CreatorCardData[]> {
  if (!isDatabaseConfigured()) return [];
  // Wired up in step 2 (Supabase schema).
  return [];
}
