import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCity } from "@/config/cities";
import { FEATURED_CITY_SLUGS, NICHES } from "@/config/site";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/landing/section-heading";

// Each city card gets its own gradient so the grid feels like a sticker sheet.
const GRADIENTS = [
  "from-violet to-pink",
  "from-pink to-orange-400",
  "from-indigo-500 to-violet",
  "from-fuchsia-500 to-rose-500",
  "from-violet to-sky-500",
  "from-rose-500 to-amber-400",
];

export function BrowseByCity() {
  const cities = FEATURED_CITY_SLUGS.map((s) => getCity(s)!);

  return (
    <section id="cities" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="📍 Browse by city"
          title={<>Local is the <span className="text-brand">whole point.</span></>}
          sub="Find creators who actually live where your customers do."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cities.map((c, i) => (
            <Reveal key={c.slug} delay={(i % 4) * 0.05}>
              <Link
                href={`/creators/${c.slug}`}
                className={`group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} p-4 text-white transition-transform duration-300 hover:-translate-y-1 active:scale-[0.97]`}
              >
                <ArrowUpRight className="absolute right-3 top-3 size-5 opacity-70 transition-transform group-hover:rotate-45" />
                <span className="font-display-tight text-2xl font-bold sm:text-3xl">{c.name}</span>
                <span className="text-xs text-white/75">{c.state}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BrowseByNiche() {
  return (
    <section id="niches" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="🎯 Browse by niche" title={<>What&apos;s your <span className="text-brand">vibe?</span></>} />
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
          {NICHES.map((n, i) => (
            <Reveal key={n.slug} delay={i * 0.04} y={12}>
              <Link
                href={`/search?niche=${n.slug}`}
                className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold transition-all hover:-translate-y-0.5 hover:glow active:scale-95"
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
