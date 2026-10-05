"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

/**
 * App-wide client providers.
 * - Dark theme by default; the toggle stores the choice in localStorage.
 * - MotionConfig honours the OS "reduce motion" setting for every animation.
 * - Toaster renders toast notifications (`toast.success("…")` from anywhere).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            classNames: {
              toast:
                "!rounded-2xl !border !border-border !bg-surface-strong !text-fg !backdrop-blur-xl !font-sans !shadow-2xl",
              description: "!text-muted",
            },
          }}
        />
      </MotionConfig>
    </ThemeProvider>
  );
}
