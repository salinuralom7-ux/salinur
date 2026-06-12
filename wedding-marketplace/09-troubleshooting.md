# 9 — Troubleshooting Guide

| Symptom | Cause | Fix |
|---|---|---|
| `FAILED_PRECONDITION: The query requires an index` | Missing composite index | Click the link in the error — it pre-fills index creation. Commit it to `firestore.indexes.json`. |
| `PERMISSION_DENIED` on a read that "should work" | Rules evaluate the *query*, not just results | The query's filters must guarantee only permitted docs match (e.g. always `where('vendorId','==',uid)`). |
| Webhook signature always invalid | Verifying a re-serialized body | Use `req.rawBody` (Functions provides it), and the **webhook** secret — not the API key secret. |
| Duplicate payment records | Razorpay retries on non-2xx / slow responses | Idempotent handler: payment doc ID = `payment.id`, transaction checks existence first (already implemented). |
| Push works on Android, silent on iOS | APNs key missing or wrong capability | Upload APNs Auth Key in Firebase console; enable Push Notifications + Background Modes in Xcode. |
| Pushes stop after app reinstall | Stale FCM token | Always `arrayUnion` the fresh token on launch; prune dead tokens on send failure (implemented in `notifyUser`). |
| First function call of the day takes 5–10 s | Cold start | Set `minInstances: 1` on `createBooking` + webhook (~₹400/mo each) once you have real traffic. |
| OTP "quota exceeded" during development | Burning real SMS quota | Authentication → Phone → add **test phone numbers**; use the Auth emulator locally. |
| Firestore bill spikes suddenly | A listener on an unbounded collection, or a list screen without pagination | Audit `onSnapshot` calls; add `.limit()`; check usage tab → it shows reads per hour. |
| `auth/app-not-authorized` on phone sign-in | SHA-1/SHA-256 not registered | Add both debug and release SHA fingerprints in Project Settings → Android app. |
| Chat messages arrive out of order | Client timestamps | Always `ServerValue.TIMESTAMP`; render sorted by push key (chronological by design). |
| Vendor sees stale availability | Local cache served first | That's offline persistence working; for the booking moment trust the server — `createBooking` re-checks in a transaction. |
| "Missing or insufficient permissions" writing fcmToken at first login | Profile doc doesn't exist yet | Create the profile doc immediately after first sign-in, before token registration. |
