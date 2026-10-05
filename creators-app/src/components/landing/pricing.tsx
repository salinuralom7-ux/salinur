import { Check } from "lucide-react";
import { site } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Sticker } from "@/components/ui/sticker";
import { SectionHeading } from "@/components/landing/section-heading";

const creatorPerks = [
  "Public profile with your own link",
  "Unlimited contacts from businesses",
  "WhatsApp + Instagram buttons on your profile",
  "Booking requests inbox",
  "See who's viewing you",
  "Cancel anytime",
];

const businessPerks = ["Search every creator in your city", "See rate cards and sample reels", "Contact creators directly", "Shortlist your favourites"];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <SectionHeading eyebrow="Pricing" title={<>One price. <span className="text-brand">No fine print.</span></>} />

        <Reveal>
          <div className="glass relative grid overflow-hidden rounded-[var(--radius-xl3)] md:grid-cols-2">
            <div className="relative p-6 sm:p-9">
              <div aria-hidden className="absolute -left-16 -top-16 size-56 rounded-full bg-violet/30 blur-3xl" />
              <Sticker tone="lime" className="relative">For creators</Sticker>
              <div className="relative mt-4 flex items-end gap-1">
                <span className="font-display-tight text-6xl font-bold sm:text-7xl">₹{site.creatorPriceInr}</span>
                <span className="mb-2 text-muted">/month</span>
              </div>
              <ul className="relative mt-5 space-y-2.5">
                {creatorPerks.map((p) => (
                  <li key={p} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-lime" /> {p}
                  </li>
                ))}
              </ul>
              <ButtonLink href="/join" size="lg" className="relative mt-6 w-full">
                Get listed
              </ButtonLink>
            </div>

            <div className="border-t border-border bg-surface p-6 sm:p-9 md:border-l md:border-t-0">
              <Sticker tone="brand" tilt={2}>For businesses</Sticker>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-display-tight text-6xl font-bold sm:text-7xl">₹0</span>
                <span className="mb-2 text-muted">/forever</span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {businessPerks.map((p) => (
                  <li key={p} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-pink" /> {p}
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
