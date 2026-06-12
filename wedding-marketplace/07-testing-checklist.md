# 7 — Testing Checklist

## Local: Firebase Emulator Suite (free, no quota burn)

```bash
firebase init emulators   # Auth, Firestore, Database, Functions, Storage
firebase emulators:start
```
Point the RN apps at emulators in dev builds
(`firestore().useEmulator('10.0.2.2', 8080)` etc.).

## Security rules (automate — this is your money's lock)

Use `@firebase/rules-unit-testing`. Must-pass cases:
- [ ] Stranger cannot read another customer's profile
- [ ] Customer cannot write to `bookings/` or `payments/` at all
- [ ] Vendor cannot change `rating`, `verified`, `subscriptionTier` on own profile
- [ ] Vendor can quote only an `open` quotation and cannot edit `customerId`
- [ ] Customer cannot create a review document directly
- [ ] Non-participant cannot read a conversation or its RTDB messages
- [ ] RTDB: sender cannot forge `senderId`, cannot edit an existing message

## Functions (emulator)

- [ ] `createBooking` rejects: unauthenticated, foreign quote, non-quoted status,
      already-booked date
- [ ] `createBooking` happy path: booking doc + held date + Razorpay order id
- [ ] Webhook: wrong signature → 400; valid `payment.captured` → payment doc +
      booking `confirmed`; **same event delivered twice → exactly one payment doc**
- [ ] `payment.failed` releases the held availability date
- [ ] `submitReview` rejects non-completed bookings and duplicates; vendor
      rating average updates correctly

## Payments end-to-end (Razorpay test mode)

- [ ] Test card success → app shows confirmed via Firestore listener (not via
      checkout callback)
- [ ] Test card failure → date released, customer notified
- [ ] Webhook signature verified against **raw body** in deployed (not just
      emulated) environment

## Notifications

- [ ] New quotation → vendor push arrives < 2s (measure: Firestore write ts vs
      device receipt)
- [ ] Dead token is pruned from `fcmTokens` after one failed send
- [ ] iOS background + killed-state delivery (APNs key configured)

## Load sanity (before launch)

- [ ] Seed 5,000 vendors, 20,000 quotations in emulator; vendor list query with
      (city, category, rating) returns < 500 ms
- [ ] Chat: 50 msg/s on one conversation stays ordered and < 200 ms RTT

## Release

- [ ] Rules deployed = rules in repo (`firebase deploy --only firestore:rules,database,storage`)
- [ ] App Check enforced; debug tokens removed
- [ ] Budget alert verified by temporarily setting it to ₹10
