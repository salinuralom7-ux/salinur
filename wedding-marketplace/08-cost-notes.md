# 8 — Cost Model Notes

Open `08-cost-estimator.csv` in Google Sheets and edit the user/booking columns;
the cost columns are computed from these unit prices (asia-south1, mid-2026 — verify
current rates at firebase.google.com/pricing before budgeting):

| Meter | Free tier | Then |
|---|---|---|
| Firestore reads | 50k/day | ~$0.06 / 100k |
| Firestore writes | 20k/day | ~$0.18 / 100k |
| Firestore storage | 1 GB | ~$0.18 / GB / mo |
| RTDB | 1 GB stored, 10 GB egress | $5/GB stored, $1/GB egress |
| Cloud Storage | 5 GB | ~$0.026 / GB |
| Functions | 2M invocations/mo | ~$0.40 / M + compute |
| FCM | **Always free** | — |
| **Phone OTP** | ~10/day | **~$0.01–0.06 per SMS to India** |

Conclusions the original draft missed:

1. **Phone OTP is your biggest early bill** — often 50–80% of total. Mitigate:
   long auth sessions (no forced re-login), App Check (blocks bot OTP abuse),
   test numbers in development, optionally WhatsApp OTP via a 3rd party later.
2. **FCM costs ₹0 at any scale** — the draft's ₹20,000/month "Messaging" line
   does not exist.
3. **Read amplification is the Firestore killer.** A vendor list screen showing
   50 vendors = 50 reads per visit. Cache aggressively (Firestore offline
   persistence is on by default in RN), paginate at 20, and never attach
   listeners to large collections.
4. Realistic 12-month infra total at the draft's own growth curve:
   **₹2.5–4 lakh including OTP**, not ₹2 lakh excluding it. Still cheap.
5. Ignore the "₹12–15 Cr revenue" line when budgeting. At 15,000 bookings/month
   × ₹40k average × 15% commission the *theoretical* run-rate is large, but
   marketplaces in this segment typically see heavy payment leakage (parties
   settling in cash off-platform). Mitigations: escrow-style payout timing,
   booking protection/insurance for the customer, and review rights tied to
   on-platform payment.
