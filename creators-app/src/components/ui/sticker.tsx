import { cn } from "@/lib/utils";

type Tone = "lime" | "brand" | "glass" | "pink";

const tones: Record<Tone, string> = {
  lime: "bg-lime text-ink",
  brand: "bg-brand text-white",
  pink: "bg-pink text-white",
  glass: "glass text-fg",
};

/**
 * Sticker-style badge: chunky, slightly tilted, like something slapped onto
 * a story. Pass `tilt={0}` for a straight badge (e.g. inside dense lists).
 */
export function Sticker({
  children,
  tone = "lime",
  tilt = -3,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  tilt?: number;
  className?: string;
}) {
  return (
    <span
      style={{ transform: `rotate(${tilt}deg)` }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-lg shadow-black/20",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
