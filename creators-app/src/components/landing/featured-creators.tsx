"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import type { CreatorCardData } from "@/types/creator";
import { CreatorCard } from "@/components/creator-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/landing/section-heading";

/**
 * Verified creators carousel. On phones it's a native swipe with snap points
 * (feels like flicking through stories); on desktop, arrow buttons scroll it.
 */
export function FeaturedCreators({ creators }: { creators: CreatorCardData[] }) {
  const track = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="✅ Verified only" title={<>Featured <span className="text-brand">creators</span></>} />

        {creators.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="The first verified creators drop here soon"
            body="We hand-check every profile before it's featured. Want to be one of the first faces businesses see?"
            action={<ButtonLink href="/join">Get listed</ButtonLink>}
          />
        ) : (
          <div className="relative">
            <div
              ref={track}
              className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 sm:mx-0 sm:px-0"
            >
              {creators.map((c) => (
                <CreatorCard key={c.handle} creator={c} className="w-[78%] shrink-0 snap-start sm:w-[300px]" />
              ))}
            </div>
            <div className="mt-4 hidden justify-end gap-2 sm:flex">
              <button onClick={() => scrollBy(-1)} className="glass grid size-11 place-items-center rounded-full" aria-label="Previous creators">
                <ChevronLeft className="size-5" />
              </button>
              <button onClick={() => scrollBy(1)} className="glass grid size-11 place-items-center rounded-full" aria-label="Next creators">
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
