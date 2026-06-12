# 10 — Scaling Roadmap (upgrade on metrics, not on months)

The original draft scheduled upgrades by calendar ("Month 5: add PostgreSQL").
Don't. Upgrade when a measured trigger fires — otherwise you're paying for
complexity you don't need.

## Stage 0 → 1: pure Firebase (now)
Everything in this pack. No DevOps. Good to roughly:
- ~100k users, ~50k bookings/month (well within Firestore limits)
- The real ceilings you'll hit first are **search** and **analytics**, not scale.

## Trigger-based upgrades

| Trigger (measured) | Action |
|---|---|
| Vendors > ~500 or users ask "photographers near me under ₹30k" | Add **Typesense/Algolia** for vendor search (sync via a Firestore trigger function). Firestore can't do text/geo/facet search — this is the first real limit you'll hit. |
| Analytics queries slow or finance wants SQL | Enable the **Firestore → BigQuery export extension** (one click). Dashboards in Looker Studio. This replaces the draft's "add PostgreSQL" phase with zero migration. |
| One doc needs > 1 sustained write/sec (hot vendor counters) | Shard the counter (10 sub-docs, sum on read) — pattern only, no infra change. |
| p95 callable latency > 800 ms | `minInstances: 1` on hot functions; move heavy work to Pub/Sub-triggered background functions. |
| OTP bill > ₹50k/month | Negotiate Razorpay/3rd-party WhatsApp OTP, lengthen session lifetimes. |
| Cross-entity invariants get hairy (payout ledgers, GST reports, reconciliation) | NOW add **Cloud SQL (PostgreSQL)** as the financial ledger, written by the same webhook function, dual-written alongside Firestore. Firebase stays the realtime/app layer. |
| Chat RTDB > 100 GB/mo bandwidth | Shard across multiple RTDB instances by conversationId hash (RTDB supports multi-instance). |

## What you will likely NEVER need to migrate
- FCM, Auth, Storage — these scale flat to millions.
- The realtime listeners powering vendor order screens — Firestore's fan-out is
  exactly the Uber/Airbnb-style pattern for this volume.

## End-state (only if you reach ~1M users)
Firestore (realtime app state) + PostgreSQL ledger (money truth) + BigQuery
(analytics) + Typesense (search) + the same Cloud Functions layer. Each added
when its trigger fired, never speculatively.
