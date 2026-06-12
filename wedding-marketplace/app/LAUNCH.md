# 🚀 Launching ShaadiSetu (the real platform)

This folder is the **full-stack web platform**: customer marketplace + vendor dashboard +
owner dashboard, with a Supabase backend. Until Supabase is connected it runs in demo mode.

## Step 1 — Turn on the database (you, ~10 min, free)

1. https://supabase.com → free account → **New project** (region **Mumbai**, save the DB password)
2. **SQL Editor** → paste ALL of `supabase/001_init.sql` → **Run**
3. **Authentication → Sign In / Up → Email**: for the smoothest start, turn **OFF**
   "Confirm email" (you can re-enable later; the app handles both, but unconfirmed
   sign-ups must check email before first sign-in)
4. **Project Settings → API** → copy Project URL + anon key
5. Open the app → footer → sign in as Platform Owner (demo) → Settings → paste → **Save & Test**
6. Reload, then **register the first real account — it automatically becomes the platform admin (you)**

## Step 2 — Put it on the internet (you, ~15 min, free)

Netlify or Vercel → import this repo → base directory `wedding-marketplace/app`,
build `npm run build`, publish `dist`. You get `shaadisetu.netlify.app`
(custom domain ~₹700/yr).

Set the two environment variables in Netlify so visitors connect automatically:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Step 3 — Operate the business

- **Vendors sign up themselves** ("List Your Business — Free") → appear in your
  Owner Dashboard → you call/verify them → **Approve** → they're live.
- **Customers** request quotes → vendors reply → customer accepts → booking is
  created with the advance instructions (your UPI ID — change it in
  `src/pages/CustomerDash.tsx`, search for `shaadisetu@upi`).
- You mark **"Advance received — confirm"** in the Owner Dashboard when the UPI
  payment lands. The date is locked for both sides.
- After the event the vendor marks it completed; the customer can then leave a
  verified review. You settle the vendor payout (amount minus your 15%) by bank/UPI.

## Step 4 — Before announcing publicly (legal)

- Fill every [bracket] in `src/pages/Legal.tsx` (legal name, address, GSTIN,
  grievance officer) and have a lawyer read the four pages once.
- GST registration; keep booking records for tax.
- Appoint the grievance officer (can be you) per the E-Commerce Rules 2020.

## Later upgrades (in order of value)

1. **Razorpay checkout** for the advance (needs your merchant KYC) — the booking flow
   is already structured for it.
2. **Vendor photo uploads** (Supabase Storage bucket + a small upload UI).
3. **WhatsApp/SMS notifications** on new leads (vendors live on WhatsApp).
4. The **native Android/iOS apps** — the complete Firebase architecture for that
   phase is in `../` (docs 01–10), ready to hand to a React Native developer.
