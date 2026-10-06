import Link from "next/link";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

/** Wordmark: gradient pin-dot + brand name. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2", className)} aria-label={`${site.name} home`}>
      <span className="relative grid size-8 place-items-center rounded-xl bg-brand shadow-lg shadow-pink/30 transition-transform group-hover:rotate-[-8deg]">
        <span className="size-2.5 rounded-full bg-lime" />
      </span>
      <span className="font-display-tight text-xl font-bold">
        {site.nameParts[0]}
        <span className="text-brand">{site.nameParts[1]}</span>
      </span>
    </Link>
  );
}
