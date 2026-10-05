"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { site } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { Sticker } from "@/components/ui/sticker";
import { CitySearch } from "@/components/landing/city-search";

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
} as const;

export function Hero() {
  return (
    // -mt pulls the hero up under the sticky header (68px tall) so the glow runs behind it.
    <section className="relative -mt-[68px] overflow-hidden px-4 pb-16 pt-[108px] sm:px-6 sm:pt-[132px]">
      {/* Drifting gradient blobs behind the hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -left-24 top-0 size-[420px] rounded-full bg-violet/40 blur-[110px]"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 top-24 size-[380px] rounded-full bg-pink/35 blur-[110px]"
          animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute bottom-0 left-1/3 size-[260px] rounded-full bg-lime/10 blur-[100px]" />
      </div>

      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.09 } } }}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <motion.div variants={item}>
          <Sticker tone="glass" tilt={-2}>
            <span className="size-2 animate-pulse rounded-full bg-lime" /> Made for local India
          </Sticker>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-6 font-display-tight text-[44px] font-bold sm:text-7xl md:text-8xl"
        >
          Your city&apos;s creators,{" "}
          <span className="text-brand">one scroll away.</span>
        </motion.h1>

        <motion.p variants={item} className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          Local businesses find and book Instagram creators near them, <b className="text-fg">free</b>. Creators get
          listed for <b className="text-fg">₹{site.creatorPriceInr}/month</b>. No commission. No middlemen.
        </motion.p>

        <motion.div variants={item} className="mt-8 w-full max-w-xl">
          <CitySearch />
        </motion.div>

        <motion.div variants={item} className="mt-6 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <ButtonLink href="/join" variant="lime" size="lg" className="w-full sm:flex-1">
            I&apos;m a Creator → Get listed for ₹{site.creatorPriceInr}/mo
          </ButtonLink>
          <ButtonLink href="/search" variant="glass" size="lg" className="w-full sm:flex-1">
            I&apos;m a Business → Find creators free <ArrowRight className="size-4" />
          </ButtonLink>
        </motion.div>

        <motion.p variants={item} className="mt-5 text-sm text-muted">
          Get booked, not ghosted. 👻🚫
        </motion.p>
      </motion.div>
    </section>
  );
}
