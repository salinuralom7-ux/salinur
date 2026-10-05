"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { site } from "@/config/site";
import { SectionHeading } from "@/components/landing/section-heading";

export const FAQS = [
  {
    q: "Is it really free for businesses?",
    a: "Yes. Searching, viewing profiles and contacting creators is free forever. Only creators pay to be listed.",
  },
  {
    q: `What do creators get for ₹${site.creatorPriceInr}/month?`,
    a: "A public profile businesses in your city can find, WhatsApp and Instagram buttons, a booking-request inbox and simple analytics. No commission on any deal you land.",
  },
  {
    q: `Does ${site.name} take a commission?`,
    a: "Never. No commission, no booking fees, no other paid plans. You keep 100% of what a business pays you.",
  },
  {
    q: "How do payments between a business and a creator work?",
    a: `Directly between you. ${site.name} only connects businesses and creators; the deal, the payment and the delivery are agreed between the two of you.`,
  },
  {
    q: "Are follower counts real?",
    a: "Creators enter their own numbers, so they're labelled \"self-reported\" until our team checks them. A Verified badge means we've checked the profile by hand.",
  },
  {
    q: "Do paid promotions have to be marked as ads?",
    a: "Yes. Creators must disclose paid promotions as ads, as required by ASCI guidelines in India.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Anytime, from your dashboard. Your profile stays live until the end of the month you've paid for, then it's hidden until you reactivate.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="🤔 FAQ" title={<>Questions? <span className="text-brand">Answered.</span></>} />
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="glass overflow-hidden rounded-3xl">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold"
                  aria-expanded={isOpen}
                >
                  {f.q}
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-strong">
                    <Plus className="size-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="px-6 pb-5 text-sm text-muted">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
