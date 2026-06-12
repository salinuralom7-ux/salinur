# 1 — Firebase Setup Guide (Console, step by step)

Time: ~45 minutes. You need a Google account and a credit/debit card (Blaze plan is
required for Cloud Functions; you still pay ₹0 until you exceed free tiers).

## A. Create the project

1. https://console.firebase.google.com → **Add project** → name: `wedding-marketplace`
2. Disable Google Analytics for now (add later) → Create.
3. **Project Settings → General → Default GCP resource location: `asia-south1` (Mumbai)**.
   ⚠️ This is permanent and must be set before creating Firestore/Storage.

## B. Upgrade to Blaze (pay-as-you-go)

1. Console → bottom-left gear → **Usage and billing → Modify plan → Blaze**.
2. Immediately set **Budgets & alerts** in the linked Google Cloud console:
   budget ₹5,000/month with alerts at 50/90/100%. This is your safety net.

## C. Authentication

1. **Build → Authentication → Get started**.
2. Enable **Phone** provider.
3. Enable **Email/Password** too (for the admin dashboard login only).
4. Settings → **Authorized domains**: add your future hosting domain.
5. (Recommended) **App Check**: Build → App Check → register both apps with
   Play Integrity (Android) / App Attest (iOS). Blocks bots from burning your OTP quota.

## D. Cloud Firestore

1. **Build → Firestore Database → Create database** → Production mode →
   location `asia-south1`.
2. Paste rules from `05-security-rules/firestore.rules` (Rules tab).
3. Indexes: deploy from `05-security-rules/firestore.indexes.json`
   (or create them on demand when the console error links prompt you).

## E. Realtime Database (chat only)

1. **Build → Realtime Database → Create database** → location: Singapore
   (`asia-southeast1` — RTDB has no Mumbai region; ~60ms from NE India, fine for chat).
2. Paste rules from `05-security-rules/database.rules.json`.

## F. Cloud Storage

1. **Build → Storage → Get started** → Production mode → `asia-south1`.
2. Paste rules from `05-security-rules/storage.rules`.

## G. Cloud Messaging (FCM)

1. Nothing to enable — FCM is on by default.
2. iOS: upload your **APNs Auth Key** (from Apple Developer) under
   Project Settings → Cloud Messaging → Apple app configuration.

## H. Register the apps

Project Settings → **Your apps**:
- Android app #1: `com.yourco.wedding.customer` → download `google-services.json`
- Android app #2: `com.yourco.wedding.vendor` → download its `google-services.json`
- iOS app #1/#2: same pattern → `GoogleService-Info.plist` each
(Two RN apps = four Firebase app registrations, one Firebase *project*.)

## I. Cloud Functions + secrets

```bash
npm i -g firebase-tools
firebase login
cd wedding-marketplace/cloud-functions
firebase init functions   # choose existing project, JavaScript, ESLint yes
# Secrets (never hardcode):
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
firebase deploy --only functions
```

## J. Razorpay side

1. https://dashboard.razorpay.com → complete KYC (PAN, bank account, business proof).
2. **Settings → API Keys** → generate → store as the secrets above.
3. **Settings → Webhooks → Add**: URL =
   `https://asia-south1-<project-id>.cloudfunctions.net/razorpayWebhook`,
   secret = the `RAZORPAY_WEBHOOK_SECRET` you set, events: `payment.captured`,
   `payment.failed`, `refund.processed`, `subscription.charged`.
4. **Route** (for vendor payouts) needs separate activation — apply early, approval
   takes days. Until approved, do payouts manually via bank transfer from the
   admin dashboard's payout list.

## K. Final checklist

- [ ] Region `asia-south1` everywhere it's offered
- [ ] Budget alert at ₹5,000/month
- [ ] Rules deployed (Firestore, RTDB, Storage) — never ship test mode
- [ ] App Check enforced for Firestore + Functions
- [ ] Razorpay webhook secret set and endpoint returning 200 in test mode
- [ ] Test phone numbers added (Authentication → Phone → test numbers) so
      development doesn't burn paid SMS
