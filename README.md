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

The phone catalog and branches are served by the backend API (see [Architecture](#architecture-full-stack)); cart, wishlist and orders persist in the browser via `localStorage`.

## Architecture (full stack)

This is a full-stack app, not a static site:

- **Backend** — a Node + Express API (`server/`) backed by SQLite (`better-sqlite3`). It owns the catalog (phones + reviews) and the branches, and computes per-branch stock. The database is seeded from `src/data/products.ts` (phones) and `server/data/branches.ts` (stores).
- **Frontend** — React 19 + TypeScript (Vite). On startup it fetches branches and the catalog from the API (`src/store/DataContext.tsx`); the rest of the app reads from that context. Cart, wishlist and orders stay on the device in `localStorage`.
- **Installable PWA** — a web manifest, app icon and service worker (`public/`) make it installable on a phone ("Add to Home Screen") and keep the shell + last-seen catalog available offline.

### API

| Method & path | Returns |
|---|---|
| `GET /api/health` | liveness check |
| `GET /api/branches` | all branches |
| `GET /api/products` | full catalog, each with `branchStock` |
| `GET /api/products/:id` | a single product |
| `GET /api/products/:id/reviews` | reviews for a product |

In production the Express server also serves the built frontend, so the whole app runs from one origin on one port.

## Run it

```bash
npm install

# Development (two processes): API on :3001 + Vite (with /api proxy) on :5173
npm run dev

# Or run pieces individually:
npm run server   # Express API + static server on :3001 (tsx watch)
npm run seed     # (re)seed the SQLite database from the seed data

# Production:
npm run build    # type-check + build the frontend into dist/
npm start        # Express serves dist/ + the API on :3001  →  open http://localhost:3001
```

The SQLite file (`server/data.sqlite`) is created and seeded automatically on first server start, and is git-ignored. Set `PORT` to change the server port and `DB_PATH` to relocate the database.

## Tech

Vite + React 19 + TypeScript on the frontend (React Router hash routing, hand-rolled responsive CSS, installable PWA); Express 5 + better-sqlite3 on the backend. Catalog seed data lives in `src/data/products.ts`, store/branch seed data in `server/data/branches.ts`. Per-branch stock is split deterministically from each phone's total `stock`, or set explicitly via a product `branchStock` map.

## Next phases (per product roadmap)

- **Phase 2:** real product photos & unit videos, live reviews, warranty claim flow, Razorpay payment integration (needs merchant keys)
- **Phase 3:** server-side orders & user accounts (phone OTP), admin inventory dashboard, trade-in program, Assamese language support
- **Phase 4:** B2B/bulk portal, analytics dashboard, referral program
