import { cn } from "@/lib/utils";

/** Shimmering placeholder block shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-surface", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

/** Placeholder with the same shape as a CreatorCard. */
export function CreatorCardSkeleton() {
  return (
    <div className="glass w-full rounded-[var(--radius-card)] p-3">
      <Skeleton className="aspect-[4/5] w-full rounded-[20px]" />
      <div className="space-y-2 p-2 pt-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
