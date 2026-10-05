"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "lime" | "brand" | "glass" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap " +
  "transition-[box-shadow,background-color,opacity] duration-200 outline-none " +
  "focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Lime is reserved for the primary call to action on a screen.
  lime: "bg-lime text-ink hover:glow-lime",
  brand: "bg-brand text-white hover:glow",
  glass: "glass text-fg hover:bg-surface-strong",
  ghost: "text-fg hover:bg-surface",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function buttonClasses(variant: Variant = "lime", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

// The "haptic" feel: buttons squash slightly when pressed.
const press = { whileTap: { scale: 0.95 }, whileHover: { y: -1 }, transition: { type: "spring", stiffness: 500, damping: 30 } } as const;

type ButtonProps = HTMLMotionProps<"button"> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, ...props },
  ref,
) {
  return <motion.button ref={ref} {...press} className={buttonClasses(variant, size, className)} {...props} />;
});

const MotionLink = motion.create(Link);

type ButtonLinkProps = React.ComponentProps<typeof MotionLink> & { variant?: Variant; size?: Size };

/** A Next.js <Link> styled and animated like a Button. */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <MotionLink {...press} className={buttonClasses(variant, size, className)} {...props} />;
}
