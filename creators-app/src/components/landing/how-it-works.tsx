"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/landing/section-heading";

const STEPS = {
  creator: [
    { emoji: "✍️", title: "Build your profile", body: "One question per screen. Niches, rates, sample reels. Done in about 3 minutes." },
    { emoji: "⚡", title: `Go live for ₹${site.creatorPriceInr}/mo`, body: "Pay with UPI or card. Your profile goes live for every business in your city." },
    { emoji: "📩", title: "Get booked, not ghosted", body: "Businesses WhatsApp you or send a booking request. You keep 100% of the deal." },
  ],
  business: [
    { emoji: "📍", title: "Search your city", body: "Filter by niche, budget, followers and language. No login needed to browse." },
    { emoji: "👀", title: "Check the vibe", body: "See sample reels, rate cards and follower stats before you reach out." },
    { emoji: "🤝", title: "Contact for free", body: "WhatsApp, Instagram or a booking request. Zero fees, zero commission." },
  ],
} as const;

type Side = keyof typeof STEPS;

export function HowItWorks() {
  const [side, setSide] = useState<Side>("creator");

  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="How it works" title={<>Three steps. <span className="text-brand">That&apos;s it.</span></>} />

        {/* Segmented toggle with a sliding pill. */}
        <div className="glass mx-auto mb-6 flex w-fit rounded-full p-1">
          {(["creator", "business"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn("relative rounded-full px-5 py-2.5 text-sm font-semibold transition-colors", side === s ? "text-ink" : "text-muted")}
            >
              {side === s && (
                <motion.span layoutId="hiw-pill" className="absolute inset-0 rounded-full bg-lime" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative">{s === "creator" ? "I'm a creator" : "I'm a business"}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.ol
            key={side}
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            className="grid gap-2.5 md:grid-cols-3 md:gap-4"
          >
            {STEPS[side].map((step, i) => (
              <motion.li
                key={step.title}
                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                className="glass relative flex gap-4 overflow-hidden rounded-[var(--radius-xl2)] p-4 md:block md:rounded-[var(--radius-card)] md:p-6"
              >
                <span className="absolute -top-5 right-1 font-display-tight text-[88px] font-bold text-fg/[0.04] md:-right-2 md:-top-6 md:text-[120px]">{i + 1}</span>
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-strong text-xl md:size-14 md:text-2xl">{step.emoji}</div>
                <div className="min-w-0">
                  <h3 className="font-display-tight text-xl font-bold md:mt-5 md:text-2xl">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted md:mt-2">{step.body}</p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </AnimatePresence>
      </div>
    </section>
  );
}
