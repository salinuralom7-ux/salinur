"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import { formatINR } from "@/lib/format";
import { MONTHLY_FOR_A_YEAR, PLANS, YEARLY_PER_MONTH_INR, YEARLY_SAVING_INR, YEARLY_SAVING_PCT, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Sticker } from "@/components/ui/sticker";
import { SectionHeading } from "@/components/landing/section-heading";

const creatorPerks = [
  "Public profile with your own link",
  "Unlimited contacts from businesses",
  "WhatsApp, Instagram & Facebook buttons on your profile",
  "Booking requests inbox",
  "See who's viewing you",
  "Cancel anytime",
];

const businessPerks = ["Search every creator in your city", "See rate cards and sample reels", "Contact creators directly", "Shortlist your favourites"];

export function Pricing() {
  // Yearly is pre-selected: it's the better deal and most creators will want it.
  const [plan, setPlan] = useState<PlanId>("yearly");
  const p = PLANS[plan];

  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <SectionHeading eyebrow="Pricing" title={<>Simple pricing. <span className="text-brand">No fine print.</span></>} />

        <Reveal>
          <div className="glass relative grid overflow-hidden rounded-[var(--radius-xl3)] md:grid-cols-2">
            <div className="relative p-6 sm:p-9">
              <div aria-hidden className="absolute -left-16 -top-16 size-56 rounded-full bg-violet/30 blur-3xl" />
              <div className="relative flex items-center justify-between gap-3">
                <Sticker tone="lime">For creators</Sticker>

                {/* Monthly / Yearly switch with a sliding pill. */}
                <div role="radiogroup" aria-label="Billing period" className="flex rounded-full bg-surface-strong p-1 text-xs font-semibold">
                  {(["monthly", "yearly"] as const).map((id) => (
                    <button
                      key={id}
                      role="radio"
                      aria-checked={plan === id}
                      onClick={() => setPlan(id)}
                      className={cn("relative rounded-full px-3 py-1.5 transition-colors", plan === id ? "text-ink" : "text-muted")}
                    >
                      {plan === id && (
                        <motion.span layoutId="billing-pill" className="absolute inset-0 rounded-full bg-fg" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                      )}
                      <span className={cn("relative", plan === id && "text-bg")}>{id === "monthly" ? "Monthly" : "Yearly"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mt-4 flex items-end gap-1.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={plan}
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -16, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-display-tight text-6xl font-bold tabular-nums sm:text-7xl"
                  >
                    {formatINR(p.priceInr)}
                  </motion.span>
                </AnimatePresence>
                <span className="mb-2 text-muted">/{p.interval}</span>
                {plan === "yearly" && (
                  <span className="mb-2 ml-1 text-sm text-muted line-through decoration-pink/70">{formatINR(MONTHLY_FOR_A_YEAR)}</span>
                )}
              </div>

              {/* Fixed height so the card doesn't jump when switching plans. */}
              <div className="relative mt-2 flex h-7 items-center gap-2 text-sm">
                {plan === "yearly" ? (
                  <>
                    <Sticker tone="pink" tilt={-2} className="shrink-0 whitespace-nowrap !px-2.5 !py-0.5 !text-[11px]">
                      Save {formatINR(YEARLY_SAVING_INR)} · {YEARLY_SAVING_PCT}% off
                    </Sticker>
                    <span className="whitespace-nowrap text-muted">Just {formatINR(YEARLY_PER_MONTH_INR)}/month</span>
                  </>
                ) : (
                  <button onClick={() => setPlan("yearly")} className="text-muted underline-offset-4 hover:text-fg hover:underline">
                    Pay yearly and save {YEARLY_SAVING_PCT}% →
                  </button>
                )}
              </div>

              <ul className="relative mt-5 space-y-2.5">
                {creatorPerks.map((perk) => (
                  <li key={perk} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-lime" /> {perk}
                  </li>
                ))}
              </ul>
              <ButtonLink href={`/join?plan=${plan}`} size="lg" className="relative mt-6 w-full">
                Get listed for {formatINR(p.priceInr)}/{p.interval}
              </ButtonLink>
            </div>

            <div className="border-t border-border bg-surface p-6 sm:p-9 md:border-l md:border-t-0">
              <Sticker tone="brand" tilt={2}>For businesses</Sticker>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-display-tight text-6xl font-bold sm:text-7xl">₹0</span>
                <span className="mb-2 text-muted">/forever</span>
              </div>
              <p className="mt-2 flex h-7 items-center text-sm text-muted">No card, no catch.</p>
              <ul className="mt-5 space-y-2.5">
                {businessPerks.map((perk) => (
                  <li key={perk} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-pink" /> {perk}
                  </li>
                ))}
              </ul>
              <ButtonLink href="/search" variant="glass" size="lg" className="mt-6 w-full">
                Find creators free
              </ButtonLink>
            </div>
          </div>
        </Reveal>

        <p className="mt-4 text-center text-sm text-muted">No commission. No booking fees. That&apos;s the whole pricing page.</p>
      </div>
    </section>
  );
}
