/**
 * Instagram / Facebook profile links.
 *
 * Creators paste these in all sorts of shapes ("@name", "instagram.com/name/",
 * "https://www.facebook.com/profile.php?id=123"). We normalise them to one
 * stored form and build the public link from that. We never call Meta's API —
 * these are plain profile links.
 */

// Instagram usernames: 1–30 chars, letters/digits/period/underscore,
// no leading/trailing period and no two periods in a row.
const IG_HANDLE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/;

// Paths that look like a profile but aren't one.
const IG_RESERVED = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv"]);

/** "@Food.Guwahati", "instagram.com/food.guwahati/?hl=en" → "food.guwahati"; null if not a valid handle. */
export function normalizeInstagram(input: string): string | null {
  let s = input.trim().toLowerCase();
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/([^/?#]+)/);
  if (url) s = url[1];
  s = s.replace(/^@/, "");
  if (!IG_HANDLE.test(s) || IG_RESERVED.has(s)) return null;
  return s;
}

export function instagramUrl(handle: string) {
  return `https://instagram.com/${handle}`;
}

// Facebook vanity names: 5+ chars, letters/digits/periods (hyphens allowed for pages).
const FB_NAME = /^[a-z0-9.\-]{5,50}$/i;
const FB_RESERVED = new Set(["groups", "events", "watch", "marketplace", "gaming", "login", "share", "sharer", "photo", "photos", "story.php", "permalink.php", "home.php"]);

/**
 * Accepts a Facebook page/profile link or a bare page name and returns the
 * stored form: the vanity name ("guwahatifoodie") or "id:123456" for
 * profile.php links. Returns null if it isn't a profile/page link.
 */
export function normalizeFacebook(input: string): string | null {
  const s = input.trim();
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|m\.|web\.|mbasic\.)?(?:facebook\.com|fb\.com)\/(.+)$/i);
  if (!url) return FB_NAME.test(s.replace(/^@/, "")) ? s.replace(/^@/, "").toLowerCase() : null;

  const rest = url[1];
  const id = rest.match(/^profile\.php\?(?:.*&)?id=(\d{5,20})/i);
  if (id) return `id:${id[1]}`;

  // Pages sometimes look like /people/Name/1000123 or /pages/Name/123.
  const numeric = rest.match(/^(?:people|pages)\/[^/]+\/(\d{5,20})/i);
  if (numeric) return `id:${numeric[1]}`;

  const name = rest.split(/[/?#]/)[0];
  if (!FB_NAME.test(name) || FB_RESERVED.has(name.toLowerCase())) return null;
  return name.toLowerCase();
}

export function facebookUrl(stored: string) {
  return stored.startsWith("id:")
    ? `https://www.facebook.com/profile.php?id=${stored.slice(3)}`
    : `https://www.facebook.com/${stored}`;
}
