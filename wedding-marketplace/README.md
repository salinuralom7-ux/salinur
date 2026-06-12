# Wedding Vendor Marketplace — Firebase Architecture Pack

Two-app marketplace (Customer app + Vendor app, React Native) for wedding vendors in
Assam/Northeast India. Commission model (15–20%) + vendor subscriptions (Free/Gold/Platinum).
Backend: Firebase (Firestore + Realtime DB for chat + Cloud Functions + FCM + Phone Auth),
payments via Razorpay.

## What's in this pack

| File | Contents |
|------|----------|
| `01-firebase-setup-guide.md` | Step-by-step console configuration |
| `02-firestore-schema.md` | All collections, fields, types, indexes |
| `03-realtime-db-chat.md` | Chat structure, presence, retention |
| `04-cloud-functions/` | **Working** Node.js code for all backend functions |
| `05-security-rules/` | Hardened Firestore + RTDB + Storage rules |
| `06-react-native-integration.md` | Connecting both apps to Firebase + Razorpay |
| `07-testing-checklist.md` | Emulator suite, rules tests, e2e booking flow |
| `08-cost-estimator.csv` + `08-cost-notes.md` | Editable cost model with realistic assumptions |
| `09-troubleshooting.md` | Common failures and fixes |
| `10-scaling-roadmap.md` | Metric-based (not month-based) upgrade triggers |

## ⚠️ Corrections to the source architecture (read first)

The draft this pack was built from contained mistakes that are fixed here:

1. **"Firestore Realtime Database" is not a thing.** Cloud Firestore and the Realtime
   Database are two separate products. This pack uses **Firestore as the system of record**
   and the **Realtime Database only for chat + presence**, which is the correct split.
2. **The Razorpay webhook verification in the draft was wrong.** It verified the *checkout*
   signature using the API key secret. Webhooks must be verified with the dedicated
   **webhook secret** against the raw request body, with idempotent processing — Razorpay
   retries webhooks, and the draft would have created **duplicate payment records**.
3. **The draft's security rules were exploitable.** They let any participant update any
   field of a booking (a customer could set `vendorPayout: 0`, a vendor could mark
   `paymentStatus: "paid"` without paying). In this pack, **bookings and payments are
   server-written only**; clients get read access and narrowly scoped writes.
4. **Reviews were spoofable.** `verified: true` was client-writable. Here, review creation
   is validated against a completed booking via rules + a Cloud Function.
5. **The revenue projection (₹12–15 crores in year one) is aspiration, not a plan.**
   Do not budget against it. The infra cost table is kept, but treat months 7–12 as
   "only if growth actually happens".
6. **Subscriptions said `stripeSubscriptionId` while the platform is Razorpay** — fixed to
   Razorpay Subscriptions throughout.
7. **Phone-OTP cost was ignored.** After the free tier (~10 SMS/day), Firebase phone auth
   in India costs real money per verification — at 100k users it can exceed the entire
   database bill. The cost model includes it.
8. **Data residency:** all resources pinned to `asia-south1` (Mumbai) for latency and
   DPDP Act alignment.

## Honest timeline

8–12 weeks to MVP is achievable for **one experienced React Native developer working
full-time** building: phone-auth onboarding, vendor profiles/portfolio, quotation flow,
chat, Razorpay checkout, and the vendor order screen. It is not achievable part-time or
without a developer. The backend in `04-cloud-functions/` is ready to deploy as-is.
