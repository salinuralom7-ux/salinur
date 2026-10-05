import "server-only";
import { getCity } from "@/config/cities";
import { NICHES, type NicheSlug } from "@/config/site";
import { avatarUrl, isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { CreatorCardData } from "@/types/creator";
import type { PublicCreatorRow } from "@/types/db";

/**
 * Public, read-only data for marketing pages.
 * Rule: never show invented numbers. Without a database, or if a query
 * fails, these return "no data" and the UI shows its empty states.
 */

export function isDatabaseConfigured() {
  return isSupabaseConfigured;
}

export type LandingStats = { creatorsLive: number; citiesLive: number };

const CARD_COLUMNS =
  "id, handle, name, photo_path, city_slug, area, niches, followers, avg_views, stats_verified, verified, rate_reel, open_to_barter, facebook";

const KNOWN_NICHES = new Set<string>(NICHES.map((n) => n.slug));

/** Turns a database row into what CreatorCard renders. */
export function toCardData(row: Pick<PublicCreatorRow, "handle" | "name" | "photo_path" | "city_slug" | "area" | "niches" | "followers" | "avg_views" | "stats_verified" | "verified" | "rate_reel" | "open_to_barter" | "facebook">): CreatorCardData {
  return {
    handle: row.handle,
    facebook: row.facebook,
    name: row.name,
    photoUrl: avatarUrl(row.photo_path),
    citySlug: row.city_slug,
    cityName: getCity(row.city_slug)?.name ?? row.city_slug,
    area: row.area,
    niches: row.niches.filter((n): n is NicheSlug => KNOWN_NICHES.has(n)),
    followers: row.followers,
    avgViews: row.avg_views,
    statsVerified: row.stats_verified,
    verified: row.verified,
    rateReel: row.rate_reel,
    openToBarter: row.open_to_barter,
  };
}

/** Live creator + city counts, or null when there is no database (or it errored). */
export async function getLandingStats(): Promise<LandingStats | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await createPublicClient().rpc("landing_stats").single<{ creators_live: number; cities_live: number }>();
  if (error || !data) {
    console.error("landing_stats failed", error);
    return null;
  }
  return { creatorsLive: Number(data.creators_live), citiesLive: Number(data.cities_live) };
}

/** Verified, live creators for the landing carousel, newest first. */
export async function getFeaturedCreators(): Promise<CreatorCardData[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createPublicClient()
    .from("public_creators")
    .select(CARD_COLUMNS)
    .eq("verified", true)
    .order("approved_at", { ascending: false })
    .limit(12);
  if (error || !data) {
    console.error("featured creators failed", error);
    return [];
  }
  return (data as unknown as PublicCreatorRow[]).map(toCardData);
}
