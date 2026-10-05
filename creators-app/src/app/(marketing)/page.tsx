import { getFeaturedCreators, getLandingStats } from "@/lib/data/public";
import { BrowseByCity, BrowseByNiche } from "@/components/landing/browse";
import { Faq } from "@/components/landing/faq";
import { FeaturedCreators } from "@/components/landing/featured-creators";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LiveStats } from "@/components/landing/live-stats";
import { Pricing } from "@/components/landing/pricing";

// Refresh real stats + featured creators at most once a minute.
export const revalidate = 60;

export default async function LandingPage() {
  const [stats, featured] = await Promise.all([getLandingStats(), getFeaturedCreators()]);

  return (
    <>
      <Hero />
      <LiveStats stats={stats} />
      <HowItWorks />
      <FeaturedCreators creators={featured} />
      <BrowseByCity />
      <BrowseByNiche />
      <Pricing />
      <Faq />
    </>
  );
}
