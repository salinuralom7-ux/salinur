import { site } from "@/config/site";
import { PLANS, YEARLY_SAVING_PCT } from "@/lib/pricing";
import type { LandingStats } from "@/lib/data/public";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

/**
 * Real counts from the database. With no data (or nobody live yet) we show
 * an honest "founding creators" banner instead of made-up numbers.
 */
export function LiveStats({ stats }: { stats: LandingStats | null }) {
  const hasNumbers = stats && stats.creatorsLive > 0;

  return (
    <section className="px-4 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        {hasNumbers ? (
          <div className="glass grid grid-cols-2 divide-x divide-border rounded-[var(--radius-card)] py-8 text-center">
            <div>
              <AnimatedCounter value={stats.creatorsLive} className="font-display-tight text-5xl font-bold text-brand sm:text-7xl" />
              <p className="mt-1 text-sm text-muted">creators live</p>
            </div>
            <div>
              <AnimatedCounter value={stats.citiesLive} className="font-display-tight text-5xl font-bold text-brand sm:text-7xl" />
              <p className="mt-1 text-sm text-muted">cities live</p>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand p-6 text-white sm:p-10">
            <div aria-hidden className="absolute -right-10 -top-10 size-48 rounded-full bg-lime/30 blur-3xl" />
            <p className="text-sm font-semibold uppercase tracking-widest text-white/80">🚀 Just launched</p>
            <h3 className="mt-2 max-w-xl font-display-tight text-[28px] [text-wrap:balance] font-bold sm:text-5xl">
              Be one of the first creators in your city.
            </h3>
            <p className="mt-2 max-w-md text-[15px] text-white/80">
              Early profiles get seen first. ₹{site.creatorPriceInr}/month, or ₹{PLANS.yearly.priceInr}/year to save {YEARLY_SAVING_PCT}%.
            </p>
            <ButtonLink href="/join" variant="lime" size="md" className="mt-5">
              Claim your spot
            </ButtonLink>
          </div>
        )}
      </Reveal>
    </section>
  );
}
