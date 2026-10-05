import { Reveal } from "@/components/ui/reveal";
import { Sticker } from "@/components/ui/sticker";

/** Consistent eyebrow sticker + big heading + optional sub-copy for each landing section. */
export function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <Reveal className="mb-10 text-center">
      <Sticker tone="brand" tilt={-2}>
        {eyebrow}
      </Sticker>
      <h2 className="mx-auto mt-4 max-w-3xl font-display-tight text-4xl font-bold sm:text-6xl">{title}</h2>
      {sub && <p className="mx-auto mt-4 max-w-xl text-muted">{sub}</p>}
    </Reveal>
  );
}
