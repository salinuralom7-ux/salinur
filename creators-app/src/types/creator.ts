import type { NicheSlug } from "@/config/site";

/** The public slice of a creator profile — what businesses see on cards and profile pages. */
export type CreatorCardData = {
  handle: string; // Instagram handle without "@"; also the public URL: /c/[handle]
  facebook: string | null; // optional Facebook page/profile, stored as normalizeFacebook() returns it
  name: string;
  photoUrl: string | null;
  citySlug: string;
  cityName: string;
  area: string | null;
  niches: NicheSlug[];
  followers: number; // self-reported unless `statsVerified`
  avgViews: number;
  statsVerified: boolean;
  verified: boolean; // admin "Verified" badge
  rateReel: number | null; // ₹ per Reel
  openToBarter: boolean;
};
