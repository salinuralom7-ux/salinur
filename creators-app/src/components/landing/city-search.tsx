"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { CITIES, cityNames, type City } from "@/config/cities";
import { NICHES } from "@/config/site";
import { cn } from "@/lib/utils";

const PLACEHOLDERS = [
  "Food creators in Guwahati…",
  "Fashion creators in Pune…",
  "Fitness creators in Bengaluru…",
  "Beauty creators in Shillong…",
  "Comedy creators in Delhi…",
  "Tech creators in Hyderabad…",
];

// Every (spelling → city) pair, longest first, so "Navi Mumbai" wins over "Mumbai".
const CITY_PATTERNS = CITIES.flatMap((c) => cityNames(c).map((n) => ({ city: c, re: new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) })))
  .sort((a, b) => b.re.source.length - a.re.source.length);

// Words that describe the search rather than the place.
const STOP_WORDS = new Set(["in", "near", "at", "from", "creators", "creator", "influencers", "influencer", "and", "the", "for", "me", ...NICHES.flatMap((n) => [n.slug, n.label.toLowerCase()])]);

/** Pulls a niche and city out of free text like "food creators in guwahati". */
function parseQuery(q: string) {
  const text = q.toLowerCase();
  const niche = NICHES.find((n) => text.includes(n.label.toLowerCase()) || text.includes(n.slug));
  const city = CITY_PATTERNS.find((p) => p.re.test(text))?.city;
  return { niche, city };
}

/** Cities (or their old names) starting with what the user typed. Big cities come first. */
function suggest(q: string): City[] {
  const words = q.toLowerCase().split(/[\s,]+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  if (!words.length) return [];
  // Also try the trailing phrase, so "north lak" finds "North Lakhimpur".
  const phrases = [...words, words.slice(-2).join(" "), words.join(" ")];
  return CITIES.filter((c) => cityNames(c).some((n) => phrases.some((w) => n.startsWith(w)))).slice(0, 6);
}

export function CitySearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [phIndex, setPhIndex] = useState(0);

  // Cycle the placeholder every 2.6s while the box is empty.
  useEffect(() => {
    if (query) return;
    const t = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 2600);
    return () => clearInterval(t);
  }, [query]);

  const { niche, city: exact } = useMemo(() => parseQuery(query), [query]);
  // A city the user has fully typed goes to the top of the list.
  const suggestions = useMemo(() => {
    const list = suggest(query);
    return exact ? [exact, ...list.filter((c) => c.slug !== exact.slug)].slice(0, 6) : list;
  }, [query, exact]);
  const open = focused && suggestions.length > 0;

  function go(city: City) {
    const params = new URLSearchParams({ city: city.slug });
    if (niche) params.set("niche", niche.slug);
    router.push(`/search?${params}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { city } = parseQuery(query);
    const pick = city ?? suggestions[active];
    if (pick) return go(pick);
    toast.error("Which city?", { description: "Type a city to search — e.g. Guwahati, Pune or Delhi." });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn("relative w-full", className)} role="search">
      <div
        className={cn(
          "glass flex h-16 items-center gap-2.5 rounded-full pl-4 pr-2 sm:gap-3 sm:pl-5 transition-shadow duration-300",
          focused && "glow",
        )}
      >
        <Search className="size-5 shrink-0 text-muted" />
        <div className="relative h-full flex-1">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            className="h-full w-full bg-transparent text-base outline-none placeholder:text-transparent"
            aria-label="Search creators by city and niche"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="search"
          />
          {/* Animated placeholder, shown only while empty. */}
          {!query && (
            <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-muted">
              <AnimatePresence mode="wait">
                <motion.span
                  key={phIndex}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="truncate"
                >
                  {PLACEHOLDERS[phIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="submit"
          className="grid h-12 min-w-12 shrink-0 place-items-center rounded-full bg-lime font-semibold text-ink sm:px-5"
          aria-label="Search"
        >
          {/* Icon-only on phones so the placeholder has room. */}
          <ArrowRight className="size-5 sm:hidden" />
          <span className="hidden sm:inline">Search</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass absolute inset-x-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-3xl p-2 text-left shadow-2xl"
          >
            {suggestions.map((c, i) => (
              <li key={c.slug} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't close first
                  onClick={() => go(c)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left",
                    i === active && "bg-surface-strong",
                  )}
                >
                  <MapPin className="size-4 text-pink" />
                  <span className="font-medium">{niche ? `${niche.label} creators in ${c.name}` : c.name}</span>
                  <span className="ml-auto text-xs text-muted">{c.state}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </form>
  );
}
