# Publishing InfluJi on Google Play

The Android app is a **Trusted Web Activity (TWA)**: a thin shell that opens the InfluJi website full-screen.
Same approach as MySheher. Website updates are app updates; you only re-upload when the shell changes.

**No domain yet?** The app points at the free address `influji.vercel.app`. When you buy `influji.in`, change
`host` in `twa-manifest.json`, bump `appVersionCode`, rebuild, and upload one update. That's the only cost of waiting.

---

## Order of work

| # | Who | Step |
|---|---|---|
| 1 | YOU | Supabase project (see `../SUPABASE-SETUP.md`) |
| 2 | YOU | Vercel account → import repo → Root Directory `creators-app` → project name **influji** → deploy |
| 3 | YOU | Add env vars in Vercel (`.env.example` lists them), incl. `NEXT_PUBLIC_SITE_URL=https://influji.vercel.app` and `NEXT_PUBLIC_SUPPORT_EMAIL` |
| 4 | YOU | Play Console → **Create app** (details below) |
| 5 | YOU/ME | Build the `.aab` (below) |
| 6 | YOU | Upload to **Closed testing**, add 12+ testers. The 14-day clock starts. |
| 7 | YOU | Copy both SHA-256 fingerprints into Vercel → `ANDROID_SHA256_FINGERPRINTS` → redeploy |
| 8 | ME | Payments (Razorpay + Google Play billing) during the 14 days |
| 9 | YOU | Apply for production access → public launch |

## Build the app bundle

Easiest: **pwabuilder.com** → enter `https://influji.vercel.app` → Package for stores → Android → Options:
- Package ID: `in.influji.app` (permanent, never change it)
- App name: `InfluJi: Find Local Influencers` · Launcher name: `InfluJi`
- Theme / background colour: `#0B0B10`
- Signing key: **Create new**, then back up the downloaded key + passwords somewhere safe (NOT in this repo, NOT in chat).
  Lose it and you can never update the app.

Or with Bubblewrap (needs Node + JDK 17): `bubblewrap init --manifest https://influji.vercel.app/manifest.webmanifest`
using the values in `twa-manifest.json`, then `bubblewrap build`.

## Fingerprints (stops the browser bar showing in the app)

Play Console → **Test and release → App integrity** → copy **both**:
- App signing key certificate → SHA-256
- Upload key certificate → SHA-256

Vercel → Settings → Environment Variables → `ANDROID_SHA256_FINGERPRINTS` = `AA:BB:...,CC:DD:...` → Redeploy.
Check: `https://influji.vercel.app/.well-known/assetlinks.json` shows both.

## Store listing (copy-paste)

**App name (30):** InfluJi: Find Local Influencers

**Short description (80):** Find & contact Instagram influencers in your city. Free for businesses.

**Full description:**

> Looking for Instagram influencers near you? InfluJi is India's local influencer marketplace.
>
> FOR BUSINESSES: restaurants, cafés, salons, gyms, coaching centres, clinics, shops, hotels
> • Search influencers by city and niche: food, fashion, beauty, fitness, tech, travel and more
> • See follower counts, rate cards and sample reels before you reach out
> • Contact them directly on WhatsApp or Instagram, or send a booking request
> • 100% free. No commission, no booking fees
>
> FOR INFLUENCERS & CREATORS
> • Build your profile in about 3 minutes
> • Get discovered by local brands in your city
> • Keep 100% of what you earn. We never take a cut
> • Simple monthly or yearly listing plan, cancel anytime
>
> 500+ cities across India, from metros to Tier 3 towns.
> Every profile is reviewed by our team. Verified badges are checked by hand.
>
> InfluJi only connects businesses and influencers; deals and payments between them are agreed directly.

**Category:** Business · **Tags:** Business, Social, Marketing
**Contact email:** your support email · **Privacy policy:** `https://influji.vercel.app/privacy`
**Account deletion URL:** `https://influji.vercel.app/delete-account`

## Graphics (in this folder)

- `play-icon-512.png`: app icon (512×512)
- `feature-graphic-1024x500.png`: feature graphic
- Phone screenshots: I'll generate these once onboarding and search are built (min. 2, 1080×1920).

## Policy answers (App content section)

- **Target audience:** 18+ only
- **Ads:** No ads
- **Data safety:** collects name, email, phone (optional), photos, user content (profile, messages), app interactions
  (profile views). Encrypted in transit: yes. Users can request deletion: yes (link above). Not sold, not shared for ads.
- **Content rating:** questionnaire → category "Social / communication"; users can interact and share contact info: yes.
- **Financial features:** none (we don't hold or move users' money).
- **Payments:** the listing subscription is a digital service, so in the Play version it goes through **Google Play billing**,
  with **user choice billing (India)** offering Razorpay as an alternative. Enrol under Monetize → Payments → User choice billing.
  Built in Phase B, before the production release.
