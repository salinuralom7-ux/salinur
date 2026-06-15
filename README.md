# Budget Phone Store 📱

An online marketplace for refurbished smartphones — built for Budget Phone Store, a multi-branch shop in Assam (Bongaigaon · Guwahati · Barpeta Road). Customers pick their nearest branch, then buy quality refurbished phones at 40–65% below retail price with transparent grading, warranty assurance, and a 15-day money-back guarantee.

This is the **Phase 1 MVP** web app: full storefront with branch selection, the 5-grade system, search & filtering, product detail pages with quality-check transparency, cart, promo codes, WhatsApp enquiry/reserve, and a complete checkout flow.

## The 5-Grade System

| Grade | Label | Battery | Warranty | Discount |
|-------|-------|---------|----------|----------|
| 🟢 A | Unboxed Like New | 95%+ | 12 months | 25–35% off MRP |
| 🔵 B | Excellent Condition | 85–95% | 6 months | 35–45% off MRP |
| 🟡 C | Very Good Condition (repaired) | 75–85% | 6 months | 45–55% off MRP |
| 🟠 D | Good — Major Parts Replaced | 60–75% | 3 months | 55–65% off MRP |
| 🔴 E | Fair — Needs Repair | <60% | 1 month (repair only) | 65–75% off MRP |

Grade E orders require an explicit "I understand this phone needs repair" confirmation at checkout.

## Branches & WhatsApp

The store runs across multiple branches, and the site is branch-aware end to end:

- **Branch picker** — first-time visitors choose their nearest branch (or "all branches"). The choice is remembered in `localStorage` and shown as a chip in the header; tap it any time to switch.
- **Per-branch stock** — Home, Shop and product pages show what's in stock *at the selected branch*. The product page lists availability across every branch, and out-of-stock cards point to branches that have the phone.
- **Stores page** (`/branches`) — a store locator with each branch's address, hours, landmark, call button, directions link and a direct WhatsApp line.
- **WhatsApp enquiry/reserve** — a floating WhatsApp button site-wide, plus per-product "Reserve on WhatsApp" (in stock) and "Enquire on WhatsApp" (out of stock) actions that open a pre-filled chat to the active branch.

**Configure branches** in [`src/data/branches.ts`](src/data/branches.ts): edit the `BRANCHES` array with each branch's name, address, hours, `phone` (tel-dialable, keep `+91…`), `whatsapp` (digits only, e.g. `919876500001`) and a Google Maps `mapUrl`. The numbers shipped are **placeholders** — replace them before going live.

**Per-branch inventory** is, by default, split deterministically from each product's total `stock` so the demo has realistic branch-by-branch availability. To set real numbers, add a `branchStock` map to any product in `src/data/products.ts`, e.g. `branchStock: { bongaigaon: 2, guwahati: 1, barpeta: 0 }`.

## What's included (Phase 1)

- **Branch selection** — pick-your-store modal, header branch chip, `/branches` store locator with call / WhatsApp / directions
- **Home page** — hero, shop-by-grade cards, branch-aware featured deals, trust section
- **Shop page** — filter by grade / brand / price / category / stock, sort, full-text search
- **Product pages** — color-coded grade badges, price vs MRP with savings, battery health, condition notes & repair history, specs table, expandable 32-point quality check, reviews with verified-purchase badges, "grade up" suggestions, similar products, video placeholder ("Dekho Aur Khareedo")
- **Cart** — quantity controls capped at stock, move-to-wishlist, low-stock warnings
- **Checkout** — 4-step flow (address → shipping → payment → review), promo codes (`WELCOME50`, `FIRST500`, `GRAD20`), EMI gating above ₹10,000, Grade E acknowledgment, COD/UPI/card/net-banking options
- **Orders & warranties** — order history with per-device warranty cards and live expiry status
- **Wishlist** — persisted locally, synced across pages

Cart, wishlist and orders persist in the browser via `localStorage` (no backend needed for the MVP).

## Run it

```bash
npm install
npm run dev      # local development at http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

The build uses a relative base path and hash routing, so the `dist/` folder deploys as-is to GitHub Pages, Netlify, Vercel or any static host.

## Tech

Vite + React 19 + TypeScript, React Router (hash routing), no UI framework — hand-rolled responsive CSS. Product catalog is seed data in `src/data/products.ts` and branches are in `src/data/branches.ts`; edit those files to add or update listings and stores.

## Next phases (per product roadmap)

- **Phase 2:** real product photos & unit videos, live reviews, warranty claim flow, Razorpay payment integration (needs merchant keys)
- **Phase 3:** backend with real inventory, user accounts (phone OTP), trade-in program, Assamese language support
- **Phase 4:** B2B/bulk portal, analytics dashboard, referral program
