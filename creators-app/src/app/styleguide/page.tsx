import type { Metadata } from "next";
import { NICHES } from "@/config/site";
import { formatCount, formatINR, formatRate } from "@/lib/format";
import type { CreatorCardData } from "@/types/creator";
import { CreatorCard } from "@/components/creator-card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastDemo } from "@/app/styleguide/toast-demo";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatorCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Sticker } from "@/components/ui/sticker";

/**
 * Internal design-system preview. Not linked from the site and not indexed.
 * The creator card below uses SAMPLE data purely to review the design —
 * real pages only ever show real creators.
 */
export const metadata: Metadata = { title: "Styleguide", robots: { index: false, follow: false } };

const sample: CreatorCardData = {
  handle: "sample.creator",
  facebook: null,
  name: "Sample Creator",
  photoUrl: null,
  citySlug: "guwahati",
  cityName: "Guwahati",
  area: "Zoo Road",
  niches: ["food", "lifestyle"],
  followers: 12400,
  avgViews: 8300,
  statsVerified: false,
  verified: true,
  rateReel: 1500,
  openToBarter: true,
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-14 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <Block title="Typography">
        <h1 className="font-display-tight text-6xl font-bold">
          Get booked, <span className="text-brand">not ghosted.</span>
        </h1>
        <p className="max-w-lg text-muted">Body copy is Inter. Headings are Space Grotesk — big, tight and bold.</p>
      </Block>

      <Block title="Colours">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            ["bg-bg border border-border", "Background"],
            ["bg-violet", "Violet #7C3AED"],
            ["bg-pink", "Pink #EC4899"],
            ["bg-brand", "Gradient"],
            ["bg-lime", "Lime #A3E635"],
            ["glass", "Glass"],
          ].map(([cls, label]) => (
            <div key={label}>
              <div className={`h-20 rounded-2xl ${cls}`} />
              <p className="mt-1.5 text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Buttons (press them)">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="#">Lime CTA</ButtonLink>
          <ButtonLink href="#" variant="brand">Brand</ButtonLink>
          <ButtonLink href="#" variant="glass">Glass</ButtonLink>
          <ButtonLink href="#" variant="ghost">Ghost</ButtonLink>
          <ToastDemo />
        </div>
      </Block>

      <Block title="Stickers & chips">
        <div className="flex flex-wrap items-center gap-3">
          <Sticker>✅ Verified</Sticker>
          <Sticker tone="brand" tilt={3}>🔥 New</Sticker>
          <Sticker tone="pink" tilt={-1}>Self-reported</Sticker>
          <Sticker tone="glass">🤝 Barter ok</Sticker>
          {NICHES.slice(0, 4).map((n) => (
            <span key={n.slug} className="glass rounded-full px-4 py-2 text-sm font-semibold">
              {n.emoji} {n.label}
            </span>
          ))}
        </div>
      </Block>

      <Block title="Numbers">
        <p className="font-display-tight text-3xl font-bold">
          {formatCount(950)} · {formatCount(12400)} · {formatCount(1250000)} · {formatINR(150000)} · {formatRate(1500, "reel")}
        </p>
      </Block>

      <Block title="Creator card (sample data, hover / tap it) + skeleton">
        <div className="grid gap-4 sm:grid-cols-3">
          <CreatorCard creator={sample} href="#" />
          <CreatorCardSkeleton />
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-24" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        </div>
      </Block>

      <Block title="Empty state">
        <EmptyState emoji="🔍" title="No creators match yet" body="Try another niche or widen your budget." action={<ButtonLink href="#" variant="glass">Clear filters</ButtonLink>} />
      </Block>
    </main>
  );
}
