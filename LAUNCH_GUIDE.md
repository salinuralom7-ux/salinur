# 🚀 Launch Guide — Budget Phone Store

This guide is written for a non-technical owner. Follow it top to bottom.
Each part says **who can do it** — you alone, or you with one technical helper for a day.

---

## Part 1 — Turn on the real database (you, ~10 minutes, free)

Right now the app runs in **demo mode**. To go live so customer orders reach you:

1. Go to **https://supabase.com** → Sign up (free) → **New project**
   - Name: `budget-phone-store`
   - Region: **Mumbai**
   - Database password: choose one and **write it down safely**
2. When the project opens, click **SQL Editor** in the left menu → **New query**
3. Open the file **`supabase/migrations/001_init.sql`** from this project, copy ALL of it,
   paste into the editor, press **Run**. You should see "Success".
4. Click **Project Settings** (gear icon) → **API**. You'll see two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long code starting with `eyJ`)
5. Open the app → scroll to the footer → **Store Admin** → **Settings** tab →
   paste both values → **Save & Test Connection**.
6. Still on the admin page, click **"First time? Create the admin account"** and register
   with your email and a strong password. **The first account becomes the store admin
   automatically** — so do this immediately after step 5.

✅ Done. Now: phones you add appear for every customer, photos upload to cloud storage,
and every customer order lands in your **Orders** tab instantly.

> Free tier limits (more than enough to start): 500MB database, 1GB file storage.

---

## Part 2 — Put the store on the internet (you, ~15 minutes, free)

Customers need a link before the app stores approve anything. Easiest path:

1. Go to **https://netlify.com** → sign up with your GitHub account
2. "Add new site" → "Import an existing project" → choose the `salinur` repository
3. Build command: `npm run build` — Publish directory: `dist`
4. Deploy. You get a link like `budgetphonestore.netlify.app` — share it on WhatsApp,
   print it on your shop board, put it in your Instagram bio.

(You can buy a custom domain like `budgetphonestore.in` for ~₹700/year inside Netlify.)

---

## Part 3 — Play Store & App Store (you + one technical helper for a day)

The native Android and iOS projects are **already generated** in the `android/` and `ios/`
folders of this repository (built with Capacitor). What remains needs accounts that only
you can create, and signing steps that need Android Studio / Xcode:

### Google Play (Android)
1. **You:** create a Google Play Console account at https://play.google.com/console
   — one-time fee **US$25 (~₹2,100)**, needs your ID and a payment card.
2. **Helper with Android Studio:** open the `android/` folder, run
   `npm run app:android`, then *Build → Generate Signed Bundle* (creates the `.aab` file
   and a signing key — **back the key up; losing it means you can never update the app**).
3. **You (in Play Console):** create the app listing —
   - Category: Shopping · Country: India
   - Upload screenshots (take them from the live site), the `.aab` file
   - **Privacy policy URL**: your live site + `/#/legal/privacy` (required)
   - **Data safety form**: declare you collect name, phone, address for order fulfilment
   - **Account deletion**: point to `/#/legal/privacy` (the policy covers deletion requests)
4. Review usually takes 1–7 days.

### Apple App Store (iOS)
1. **You:** Apple Developer Program at https://developer.apple.com — **US$99/year (~₹8,500)**.
2. **Helper with a Mac + Xcode:** open the `ios/` folder via `npm run app:ios`,
   set the signing team, archive, upload via App Store Connect.
3. Same listing requirements (privacy policy URL, screenshots).
4. Apple review is stricter; a shopping app with real products and policies normally passes.

> 💡 Honest advice: launch the **website first** (Part 2) — it costs nothing and works on
> every phone today. Do Play Store next (cheap, one-time fee). Do the App Store once
> sales justify the yearly fee.

---

## Part 4 — Taking real payments (you, ~2–3 days for approval)

The checkout currently records orders with "payment on delivery/confirmation" — money
does not move through the app yet. To accept UPI/cards online:

1. Sign up at **https://razorpay.com** (Indian payment gateway)
2. KYC needs: PAN, bank account, business proof (GST registration or Udyam/shop licence)
3. Once approved you get **API keys** — share them with Claude/your developer and the
   Razorpay checkout gets wired in (the order flow is already built for it).

Until then, the safest pattern (used by many local sellers): customer places the order in
the app → you confirm by phone/WhatsApp → collect via UPI or cash on delivery.

---

## Part 5 — Legal checklist before launch (you + ideally a lawyer once)

The app already contains Terms & Conditions, Privacy Policy (DPDP Act 2023), Returns &
Refunds, and a Grievance Officer page. **Before launch you must:**

- [ ] Fill every **[bracketed placeholder]** in `src/pages/Legal.tsx`: legal/proprietor
      name, full shop address, phone, email, GSTIN, grievance officer name
- [ ] **GST registration** — required for selling online across state lines in India
- [ ] Appoint a **Grievance Officer** (can be you) — required by the Consumer Protection
      (E-Commerce) Rules 2020; complaints acknowledged in 48h, resolved in 1 month
- [ ] Keep **purchase invoices for every phone you buy** and verify IMEI before listing —
      never deal in lost/stolen/blacklisted devices
- [ ] Issue a **GST tax invoice with every sale** (digital + printed)
- [ ] Honour the **grade descriptions and warranty periods** shown in the app — they are
      legally part of your offer
- [ ] Have a lawyer read the four legal pages once (₹2,000–5,000 typically)

---

## Daily use (after launch)

- **Add a phone:** Store Admin → Products → "+ Add Phone / Accessory" → pick the model
  (specs auto-fill) → set grade, battery %, honest condition notes, price (the app
  suggests one), stock → add photos → Save.
- **See orders:** Store Admin → Orders. New orders show 🕐. Update the status as you
  confirm → ship → deliver; keep the customer informed on WhatsApp.
- **Remove a sold-out listing:** Edit → set stock to 0 (shows "Out of stock"), or Remove.
