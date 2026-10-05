# CreatorCity

India's marketplace where local businesses discover and book Instagram creators near them.

- **Creators** pay ₹99/month to be listed.
- **Businesses** search, view and contact creators for free.
- No commission, no booking fees, no other paid plans.

> "CreatorCity" is a placeholder brand. Rename it in one place: `src/config/site.ts`.

## Tech stack

| Part | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4, design tokens in `src/app/globals.css` |
| Animation | Framer Motion |
| Database / Auth / Storage | Supabase (step 2) |
| Payments | Razorpay Subscriptions + webhooks (step 5) |
| Hosting | Vercel |

## Run it locally

You need **Node.js 20.9+** (22 recommended).

```bash
cd creators-app
npm install
cp .env.example .env.local   # fill in keys as each step needs them
npm run dev                  # http://localhost:3000
```

To test on your phone over the same Wi-Fi, open `http://<your-computer's-IP>:3000`.

Other commands:

```bash
npm run build && npm start   # production build, closest to what Vercel runs
npm run lint                 # ESLint
npm test                     # unit tests (cities, Instagram/Facebook link parsing)
```

Useful pages while building:

- `/` — landing page
- `/styleguide` — every design-system component (not linked from the site, not indexed)

## Project structure

```
src/
  app/
    (marketing)/        public pages with header + footer (landing, later search, profiles, legal)
    styleguide/         design-system preview
    globals.css         colour tokens (dark default + light), fonts, glass/glow/grain utilities
    layout.tsx          fonts, metadata, theme provider
  components/
    ui/                 Button, Sticker, Reveal, AnimatedCounter, Skeleton, EmptyState
    landing/            landing page sections
    creator-card.tsx    tilt + glow creator card
  config/
    site.ts             brand name, price, niches, featured cities
    cities.ts           526 Indian cities, Tier 1–3, with old-name aliases (Gurgaon, Bangalore…)
  lib/
    format.ts           12.4K / ₹1,500 / ₹1,500/reel formatting
    social.ts           cleans pasted Instagram handles and Facebook links into one stored form
    data/public.ts      public read-only data (returns empty until Supabase is connected)
  types/
```

## Design system

- **Dark by default** (`#0B0B10`), light mode via the toggle. Components only use semantic tokens
  (`bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `border-border`), so both themes stay in sync.
- **Accents:** violet `#7C3AED` → pink `#EC4899` gradient (`bg-brand`, `text-brand`); lime `#A3E635`
  is reserved for the primary call to action.
- **Type:** Space Grotesk for headings (`font-display-tight`), Inter for body.
- **Shapes:** 20–28px radii, `glass` cards, `glow` on hover, film grain over the whole page.
- **Motion:** buttons squash on tap, sections reveal on scroll, every animation respects the
  OS "reduce motion" setting.
- **Honest numbers:** counters and featured creators only ever show real database data. With no data,
  designed empty states appear instead.

## Product decisions so far

- **Cities:** every state and UT, Tier 1 (metros + satellites), Tier 2 (≈ Y-class) and Tier 3 (towns and
  district HQs). To add a city, add one line in `src/config/cities.ts`. Never change an existing slug — it's a URL.
- **Instagram & Facebook:** creators add their Instagram handle and, optionally, a Facebook page/profile link.
  These are plain profile links shown as buttons; we don't use Meta's API. Follower counts stay
  "self-reported" until an admin verifies them.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo.
3. Set **Root Directory** to `creators-app` (this repo also contains another app).
4. Add the environment variables from `.env.example` under **Settings → Environment Variables**.
5. Deploy. Set `NEXT_PUBLIC_SITE_URL` to your real domain once you have one.

## Build progress

- [x] 1. Project setup, design system, landing page
- [ ] 2. Supabase schema + auth
- [ ] 3. Creator onboarding + profile pages
- [ ] 4. Search and filters
- [ ] 5. Razorpay subscription + webhooks
- [ ] 6. Creator dashboard and booking requests
- [ ] 7. Admin panel
- [ ] 8. SEO pages, OG images, legal pages, polish, performance
