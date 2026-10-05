import { Reveal } from "@/components/ui/reveal";

/**
 * Consistent section opener: a quiet eyebrow label, a big tight heading and
 * optional sub-copy. Kept restrained on purpose — the loud stickers are saved
 * for badges on creator cards so they keep their punch.
 */
export function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <Reveal className="mb-6 text-center sm:mb-10">
      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        <span className="size-1.5 rounded-full bg-brand" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="mx-auto mt-3 max-w-3xl font-display-tight text-[34px] font-bold [text-wrap:balance] sm:text-6xl">
        {title}
      </h2>
      {sub && <p className="mx-auto mt-3 max-w-md text-[15px] text-muted sm:text-base">{sub}</p>}
    </Reveal>
  );
}
