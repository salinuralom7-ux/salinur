import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CITIES, getCity } from "@/config/cities";
import { FEATURED_CITY_SLUGS, NICHES } from "@/config/site";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

// Each city card gets its own gradient so the grid feels like a sticker sheet.
const GLOWS = ["bg-violet", "bg-pink", "bg-fuchsia-500", "bg-indigo-500", "bg-rose-500", "bg-purple-500"];

export function BrowseByCity() {
  const cities = FEATURED_CITY_SLUGS.map((s) => getCity(s)!);

  return (
    <section id="cities" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Browse by city"
          title={<>Local is the <span className="text-brand">whole point.</span></>}
          sub="Find creators who actually live where your customers do."
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {cities.map((c, i) => (
            <Reveal key={c.slug} delay={(i % 4) * 0.05}>
              <Link
                href={`/creators/${c.slug}`}
                className="glass group relative flex h-28 flex-col justify-end overflow-hidden rounded-[var(--radius-xl2)] p-4 transition-all duration-300 hover:-translate-y-1 hover:glow active:scale-[0.97] sm:h-36"
              >
                <span aria-hidden className={`absolute -right-8 -top-8 size-28 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100 ${GLOWS[i % GLOWS.length]}`} />
                <ArrowUpRight className="absolute right-3 top-3 size-4 text-muted transition-transform group-hover:rotate-45 group-hover:text-fg" />
                <span className="relative font-display-tight text-[22px] font-bold sm:text-3xl">{c.name}</span>
                <span className="relative text-xs text-muted">{c.state}</span>
              </Link>
            </Reveal>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          + {CITIES.length - cities.length} more cities, from Tier 1 metros to Tier 3 towns. Search yours at the top.
        </p>
      </div>
    </section>
  );
}

export function BrowseByNiche() {
  return (
    <section id="niches" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Browse by niche" title={<>What&apos;s your <span className="text-brand">vibe?</span></>} />
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
          {NICHES.map((n, i) => (
            <Reveal key={n.slug} delay={i * 0.04} y={12}>
              <Link
                href={`/search?niche=${n.slug}`}
                className="glass inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-all hover:-translate-y-0.5 hover:glow active:scale-95"
              >
                <span aria-hidden>{n.emoji}</span> {n.label}
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
