"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";

const links = [
  { href: "/search", label: "Find creators" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  const signedIn = useSignedIn();

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full px-3 pl-4 transition-all duration-300",
          scrolled || open ? "glass shadow-xl shadow-black/10" : "border border-transparent",
        )}
      >
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthLink signedIn={signedIn} className="hidden rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-fg md:inline-flex" />
          <ButtonLink href="/join" size="sm" className="hidden sm:inline-flex">
            Get listed · ₹{site.creatorPriceInr}
          </ButtonLink>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen((o) => !o)}
            className="glass grid size-10 place-items-center rounded-full md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass mx-auto mt-2 max-w-6xl rounded-[var(--radius-card)] p-3 md:hidden"
            aria-label="Mobile"
          >
            {links.map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-lg font-medium hover:bg-surface"
                >
                  {l.label}
                </Link>
              </motion.div>
            ))}
            <AuthLink signedIn={signedIn} className="block w-full rounded-2xl px-4 py-3 text-left text-lg font-medium hover:bg-surface" />
            <ButtonLink href="/join" size="lg" className="mt-2 w-full" onClick={() => setOpen(false)}>
              I&apos;m a creator → Get listed for ₹{site.creatorPriceInr}/mo
            </ButtonLink>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** True once Supabase says someone is logged in; follows logins and logouts live. */
function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

/** "Log in" link, or a "Log out" button (POST, so prefetching can't log anyone out). */
function AuthLink({ signedIn, className }: { signedIn: boolean; className?: string }) {
  if (!isSupabaseConfigured) return null;
  if (!signedIn) {
    return (
      <Link href="/login" className={className}>
        Log in
      </Link>
    );
  }
  return (
    <form action="/auth/signout" method="post" className="contents">
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  );
}
