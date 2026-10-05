/** Row shapes returned by Supabase. Kept by hand until we generate them with `supabase gen types`. */

/** A row of the `public_creators` view: live creators only, public columns only. */
export type PublicCreatorRow = {
  id: string;
  handle: string;
  name: string;
  photo_path: string | null;
  city_slug: string;
  area: string | null;
  niches: string[];
  languages: string[];
  followers: number;
  avg_views: number;
  stats_verified: boolean;
  verified: boolean;
  rate_reel: number | null;
  rate_story: number | null;
  rate_post: number | null;
  open_to_barter: boolean;
  sample_links: string[];
  bio: string | null;
  whatsapp: string | null;
  contact_email: string | null;
  youtube: string | null;
  facebook: string | null;
  view_count: number;
  approved_at: string | null;
  created_at: string;
};
