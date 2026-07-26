# Budget Phone Store

An online shop for second-hand phones, built for Budget Phone Store in Bongaigaon, Assam.

Customers search the shelf, pick a model, capacity, colour and condition, ask for photographs of the
actual handset, and either pay in full through Razorpay or book the phone with a cash-on-delivery
booking charge.

> **Account separation.** This shop is entirely its own business. Every account it uses — Razorpay,
> hosting, email — belongs to **budgetphonestorebongaigaon@gmail.com**. It shares no credentials,
> storage or services with anything else in this repository, including the Nearse site under `docs/`.

---

## What the shop does

### Four conditions, not one vague word

Every handset is inspected on 42 points and then placed in one of four conditions. The condition
fixes the price, the warranty and what goes in the box.

| Condition | What it means | Battery | Warranty | Price |
|---|---|---|---|---|
| **Superb** | Indistinguishable from new; no marks at all | 95–100% | 12 months | reference price |
| **Excellent** | Hairline marks visible only against a light | 88–95% | 9 months | 89% |
| **Good** | Honest wear, faultless function; may be repaired | 80–88% | 6 months | 78% |
| **Moderate** | Deep scratches and dents, priced accordingly | 75–82% | 3 months | 65% |

Conditions are browsable as categories at `/condition/superb` and so on, and are explained in full on
the **How it works** page.

### Categories by brand

Every maker has its own page at `/brand/apple`, `/brand/samsung` and so on, with models grouped by the
series they were sold under (iPhone 15 Series, Galaxy S24, Redmi Note…).

### Colour and storage on every phone

Each model carries the colours and capacities the manufacturer actually sold. All 38 iPhone models are
covered, from the iPhone 7 through the 17 Pro Max, with their real finishes — Midnight, Sierra Blue,
Deep Purple, Natural Titanium, Desert Titanium, Cosmic Orange and the rest. Colours we do not currently
hold are shown struck through rather than hidden, so a customer can see the full range and ask us to
source one.

### Real photographs, on request

The shop deliberately publishes no stock press photos. Every handset is a different physical object,
and one gallery cannot honestly represent twenty units of the same model in four conditions. Instead,
**“See the real photos”** on any listing opens a short form and hands the request to WhatsApp with the
unit reference already filled in, so the shop knows exactly which phone to photograph.

### Paying: in full, or a booking charge

- **Pay in full** — the whole amount through Razorpay (UPI, card, net banking, wallet).
- **Cash on delivery** — secured by a booking charge paid online of **at least one tenth of the order
  total**, with the balance in cash to the courier. The customer can raise the booking charge to any
  amount up to the full total using presets or a slider.

The booking charge floor is enforced in three places: the slider cannot go below it, `computeTotals`
clamps any value passed to it, and the serverless order route re-checks it before asking Razorpay for
a single rupee. `npm test` asserts the floor holds for every one of the 1,925 listings in stock.

---

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check and build into dist/
npm run verify    # lint + build + tests, the pre-push check
```

### Tests

```bash
npm test          # booking-charge maths and Razorpay signature verification
npm run smoke     # full browser walk-through: search → variants → COD → order
```

`npm test` needs nothing running. `npm run smoke` drives a real browser through the whole purchase and
needs a server on port 4173 (`npm run build && npm run preview`) and Playwright installed.

---

## How payment works

Money is never decided by the browser.

1. The browser posts **what is in the cart** — listing ids and quantities, never prices — to
   `POST /api/razorpay/order`.
2. That route recomputes the total from the same catalog and the same pricing rules the storefront
   uses, verifies the booking charge clears the one-tenth floor, and asks Razorpay to open an order
   for exactly that many paise.
3. Razorpay Checkout collects the payment and hands three values back to the browser.
4. The browser posts those to `POST /api/razorpay/verify`, which recomputes the HMAC-SHA256 signature
   with the account secret — the one value a client cannot know — and compares it in constant time.
   Only then is the order recorded as paid.

A modified client can therefore change what it asks for, but not what it is charged.

**Before the merchant account is live**, the payment step runs in a clearly-labelled test mode: the
order is recorded so the whole flow can be walked end to end, and both the checkout and the
confirmation page say plainly that no money has moved. Set `VITE_PAYMENTS_MODE=live` to switch that
fallback off once real keys are in place.

See **[RAZORPAY.md](RAZORPAY.md)** for the account setup, written step by step.

---

## Before going live

Two values need filling in, both in [`src/config.ts`](src/config.ts):

| What | Where | Currently |
|---|---|---|
| Shop WhatsApp number | `STORE.whatsapp` | `910000000000` — a placeholder |
| Razorpay keys | hosting environment | not set; shop runs in test mode |

The WhatsApp number is what every photo request and order enquiry is sent to, so the shop cannot
open without it. Use the country code with no plus sign or spaces: `919876543210`.

---

## Deploying

The app needs a host that can run the two serverless routes under `api/`, since Razorpay cannot be
used safely from a static page. It is configured for **Vercel** out of the box:

1. Import the repository at [vercel.com/new](https://vercel.com/new), signed in as
   budgetphonestorebongaigaon@gmail.com.
2. Vercel reads `vercel.json` — build command, output directory and the SPA rewrite are already set.
3. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` under **Settings → Environment Variables**.
4. Redeploy so the new variables take effect.

Netlify and Cloudflare Pages work too — `public/_redirects` carries the same SPA fallback — but their
function formats differ slightly from the handlers in `api/`. Plain static hosting (GitHub Pages) will
serve the shop but cannot process payments, so it stays in test mode.

> The GitHub Pages workflow in this repository publishes `docs/`, which is the **Nearse** site, not
> this shop. Deploying the shop does not touch it.

---

## How the code is arranged

```
src/
  config.ts            shop details and commercial policy — the booking-charge floor lives here
  types.ts             every shape used across the app
  data/
    conditions.ts      the four conditions and the 42-point inspection
    colors.ts          manufacturer colour names → swatches
    catalog/           all 91 models: apple.ts, samsung.ts, xiaomi.ts, android.ts
  lib/
    inventory.ts       generates the shelf from the catalog; swap for a real API later
    pricing.ts         totals, promo codes, the booking-charge floor — shared with the server
    search.ts          search scoring and filtering
    razorpay.ts        browser side of the payment flow
  components/, pages/, store/
api/
  razorpay/order.ts    recomputes the amount, opens a Razorpay order
  razorpay/verify.ts   verifies the signature, checks the payment state
tests/
  payments.test.ts     booking-charge and signature assertions
  smoke.mjs            browser walk-through of the whole purchase
```

### Changing prices

Prices live in one place: each model's `storage` tuples in `src/data/catalog/`, written as
`[capacity GB, launch MRP, our Superb price]`. The other three conditions are derived from the Superb
price by the multipliers in `src/data/conditions.ts`, so a price change is a single edit.

### Replacing generated stock with real inventory

`src/lib/inventory.ts` builds the shelf deterministically from the catalog — the same phone always has
the same battery reading, unit reference and stock count. Nothing outside that module knows where
listings come from, so pointing it at a real inventory API later is a contained change.

---

## Still to come

- Real inventory and a stock system, replacing the generated shelf
- Customer accounts, so orders are not tied to one browser
- A Razorpay webhook and an order database, so payment state survives a closed tab
- Uploading the photographs taken on request against the unit reference
- Assamese alongside English
