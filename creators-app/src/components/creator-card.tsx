"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { BadgeCheck, MapPin } from "lucide-react";
import { NICHES } from "@/config/site";
import { formatCount, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CreatorCardData } from "@/types/creator";
import { Sticker } from "@/components/ui/sticker";

const nicheBySlug = new Map<string, (typeof NICHES)[number]>(NICHES.map((n) => [n.slug, n]));

/**
 * Creator card used in carousels and search results.
 * Tilts in 3D toward the pointer and glows on hover; squashes on tap.
 * `href` defaults to the creator's public profile.
 */
export function CreatorCard({ creator, className, href }: { creator: CreatorCardData; className?: string; href?: string }) {
  // Pointer position within the card, -0.5..0.5 on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 250, damping: 20 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-8, 8]), { stiffness: 250, damping: 20 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return; // touch scrolling shouldn't wobble the card
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() {
    px.set(0);
    py.set(0);
  }

  const initials = creator.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      whileTap={{ scale: 0.97 }}
      className={cn("group relative", className)}
    >
      <Link
        href={href ?? `/c/${creator.handle}`}
        className="glass block rounded-[var(--radius-card)] p-3 transition-shadow duration-300 group-hover:glow"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-brand">
          {creator.photoUrl ? (
            <Image
              src={creator.photoUrl}
              alt={creator.name}
              fill
              sizes="(max-width: 640px) 80vw, 300px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center font-display-tight text-6xl font-bold text-white/90">
              {initials}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          {creator.verified && (
            <Sticker tone="lime" className="absolute left-3 top-3">
              <BadgeCheck className="size-3.5" /> Verified
            </Sticker>
          )}
          {creator.openToBarter && (
            <Sticker tone="glass" tilt={3} className="absolute right-3 top-3 !text-white">
              🤝 Barter ok
            </Sticker>
          )}
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between text-white">
            <div>
              <div className="font-display-tight text-2xl font-bold">{formatCount(creator.followers)}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/70">
                followers{creator.statsVerified ? "" : " · self-reported"}
              </div>
            </div>
            {creator.rateReel != null && (
              <div className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur-md">
                {formatRate(creator.rateReel, "reel")}
              </div>
            )}
          </div>
        </div>

        <div className="px-1.5 pb-1 pt-3">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-lg font-semibold">{creator.name}</h3>
            {creator.verified && <BadgeCheck className="size-4 shrink-0 text-lime" aria-label="Verified" />}
          </div>
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" />
            {creator.area ? `${creator.area}, ` : ""}
            {creator.cityName} · @{creator.handle}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {creator.niches.map((slug) => {
              const n = nicheBySlug.get(slug);
              return (
                <span key={slug} className="rounded-full bg-surface-strong px-2.5 py-1 text-xs font-medium">
                  {n?.emoji} {n?.label ?? slug}
                </span>
              );
            })}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
