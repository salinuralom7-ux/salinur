# Budget Phone Store 📱

An online marketplace for refurbished smartphones — built for Budget Phone Store, Bongaigaon, Assam. Customers buy quality refurbished phones at 40–65% below retail price with transparent grading, warranty assurance, and a 15-day money-back guarantee.

Full storefront **plus a Supabase backend and store admin panel**: the owner adds phones (with photo uploads and an auto-fill spec catalog of popular models), and customer orders arrive in the admin dashboard in real time. Native Android/iOS projects (Capacitor) are included for Play Store / App Store packaging.

**👉 Start here: [LAUNCH_GUIDE.md](./LAUNCH_GUIDE.md)** — step-by-step instructions for connecting Supabase, deploying the site, publishing to the app stores, payments, and the legal checklist.

## The 5-Grade System

| Grade | Label | Battery | Warranty | Discount |
|-------|-------|---------|----------|----------|
| 🟢 A | Unboxed Like New | 95%+ | 12 months | 25–35% off MRP |
| 🔵 B | Excellent Condition | 85–95% | 6 months | 35–45% off MRP |
| 🟡 C | Very Good Condition (repaired) | 75–85% | 6 months | 45–55% off MRP |
| 🟠 D | Good — Major Parts Replaced | 60–75% | 3 months | 55–65% off MRP |
| 🔴 E | Fair — Needs Repair | <60% | 1 month (repair only) | 65–75% off MRP |

Grade E orders require an explicit "I understand this phone needs repair" confirmation at checkout.

## What's included (Phase 1)

- **Home page** — hero, shop-by-grade cards, featured deals, trust section
- **Shop page** — filter by grade / brand / price / category / stock, sort, full-text search
- **Product pages** — color-coded grade badges, price vs MRP with savings, battery health, condition notes & repair history, specs table, expandable 32-point quality check, reviews with verified-purchase badges, "grade up" suggestions, similar products, video placeholder ("Dekho Aur Khareedo")
- **Cart** — quantity controls capped at stock, move-to-wishlist, low-stock warnings
- **Checkout** — 4-step flow (address → shipping → payment → review), promo codes (`WELCOME50`, `FIRST500`, `GRAD20`), EMI gating above ₹10,000, Grade E acknowledgment, COD/UPI/card/net-banking options
- **Orders & warranties** — order history with per-device warranty cards and live expiry status
- **Wishlist** — persisted locally, synced across pages
- **Store Admin** (`/#/admin`) — add/edit/remove listings with photo uploads and a built-in spec catalog (~30 popular iPhone/Android models auto-fill processor, display, camera, battery specs); orders dashboard with status workflow (pending → confirmed → shipped → delivered); Supabase connection settings
- **Legal pages** — Terms, Privacy (DPDP Act 2023), Returns & Refunds, Grievance Officer contact per the Consumer Protection (E-Commerce) Rules 2020

## Backend

**Connected mode:** products, orders and product photos live in Supabase (PostgreSQL + Storage) with row-level security — anyone can browse and place orders; only the admin account can manage listings and read orders. The complete schema is one file: `supabase/migrations/001_init.sql`. The first registered account automatically becomes admin.

**Demo mode:** until Supabase is connected (Admin → Settings), everything works locally in the browser so the owner can explore safely.

## Run it

```bash
npm install
npm run dev      # local development at http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

The build uses a relative base path and hash routing, so the `dist/` folder deploys as-is to GitHub Pages, Netlify, Vercel or any static host.

## Tech

Vite + React 19 + TypeScript, React Router (hash routing), no UI framework — hand-rolled responsive CSS. Product catalog is seed data in `src/data/products.ts`; edit that file to add or update listings.

## Next phases (per product roadmap)

- **Phase 2:** real product photos & unit videos, live reviews, warranty claim flow, Razorpay payment integration (needs merchant keys)
- **Phase 3:** backend with real inventory, user accounts (phone OTP), trade-in program, Assamese language support
- **Phase 4:** B2B/bulk portal, analytics dashboard, referral program
