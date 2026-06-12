# 2 — Firestore Collection Schema

Conventions: document IDs are auto-IDs unless stated; all money is **integer paise**
(₹50,000 → `5000000`) to avoid floating-point bugs; all timestamps are Firestore
`timestamp`; denormalized display fields (names, photos) are duplicated intentionally
to avoid N+1 reads on list screens.

## vendors/{vendorId}            (vendorId = auth UID)
| Field | Type | Notes |
|---|---|---|
| name | string | business name |
| ownerName | string | |
| phone | string | E.164, from auth |
| category | string | `photography` \| `catering` \| `decor` \| `makeup` \| `venue` \| `music` \| `mehndi` \| `priest` \| `other` |
| city | string | lowercase slug, e.g. `bongaigaon` |
| serviceAreas | array<string> | city slugs they travel to |
| languages | array<string> | `["as","bn","hi","en"]` |
| bio | string | ≤ 1000 chars |
| portfolio | array<string> | Storage download URLs, ≤ 30 |
| coverPhoto | string | |
| pricing | map | `{ basic: int, standard: int, premium: int }` paise |
| packages | array<map> | `{ title, description, price }` |
| rating | number | denormalized avg, server-written |
| reviewCount | int | server-written |
| subscriptionTier | string | `free` \| `gold` \| `platinum`, server-written |
| verified | bool | server-written after doc review |
| kycStatus | string | `pending` \| `submitted` \| `approved` \| `rejected` |
| fcmTokens | array<string> | multi-device; pruned on send failure |
| stats | map | `{ responseTimeMins, acceptanceRate, completedBookings }` server-written |
| status | string | `active` \| `paused` \| `suspended` |
| createdAt / updatedAt | timestamp | |

### vendors/{vendorId}/availability/{YYYY-MM}
One doc per month — `days: { "15": "free"|"booked"|"blocked", ... }`.
(A map per month, not one doc per day: 1 read shows a whole calendar month.)

## customers/{customerId}        (customerId = auth UID)
name, phone, city, weddingDate (timestamp), guestCount (int), budgetBand
(`low|medium|high|premium`), preferences (map), savedVendors (array<string> ≤ 100),
fcmTokens (array<string>), locale (`as|bn|hi|en`), createdAt.

## quotations/{quoteId}
| Field | Type | Notes |
|---|---|---|
| customerId / vendorId | string | |
| customerName / vendorName | string | denormalized |
| category, eventDate, eventCity | | |
| requirements | string | customer's brief |
| quotedPrice | int? | paise, set by vendor |
| quoteNote | string? | vendor's message |
| status | string | `open` → `quoted` → `accepted` \| `declined` \| `expired` |
| expiresAt | timestamp | TTL policy field (auto-delete after 90 days) |
| createdAt / quotedAt / respondedAt | timestamp | |

## bookings/{bookingId}          — SERVER-WRITTEN ONLY
| Field | Type | Notes |
|---|---|---|
| customerId / vendorId / quoteId | string | |
| customerName / vendorName / category | string | denormalized |
| eventDate | timestamp | |
| amount | int | paise |
| commissionRate | number | 0.15–0.20, frozen at creation |
| commission / vendorPayout | int | computed server-side |
| status | string | `pending_payment` → `confirmed` → `completed` \| `cancelled` \| `refunded` |
| paymentStatus | string | `pending` \| `paid` \| `failed` \| `refunded` |
| razorpayOrderId | string | |
| cancellationPolicy | string | snapshot at booking time (legal) |
| createdAt / confirmedAt / completedAt / cancelledAt | timestamp | |

## payments/{paymentId}          — SERVER-WRITTEN ONLY (doc ID = razorpayPaymentId → idempotency)
bookingId, customerId, vendorId, amount, platformFee, vendorReceives (int paise),
razorpayOrderId, method, status (`captured|failed|refunded`), capturedAt,
payout: `{ status: pending|processing|completed|failed, utr, paidAt }`, createdAt.

## reviews/{reviewId}            (reviewId = bookingId → one review per booking, free dedupe)
vendorId, customerId, bookingId, customerName, rating (int 1–5), text (≤ 2000),
photos (array ≤ 5), verified (always true — creation requires completed booking),
vendorReply `{ text, repliedAt }?`, helpfulVotes (int, server-incremented), createdAt.

## conversations/{conversationId}   (ID = `${vendorId}_${customerId}`)
Firestore holds the **inbox metadata** only — messages live in RTDB (see 03):
participants (array), participantNames (map), lastMessage (string ≤ 200),
lastMessageAt (timestamp), unread (map uid→int), bookingId?, createdAt.

## subscriptions/{vendorId}      — SERVER-WRITTEN ONLY
tier, priceMonthly (paise), razorpaySubscriptionId, status
(`active|past_due|cancelled|expired`), currentPeriodEnd (timestamp),
features (array<string>), createdAt / updatedAt.

## analytics/daily/{YYYY-MM-DD}  and  analytics/vendors/{vendorId}/monthly/{YYYY-MM}
Aggregates written by the nightly job: bookingsCreated, bookingsCompleted, gmv,
commission, newCustomers, newVendors, activeUsers / per-vendor: leads, quotesSent,
bookings, earnings, avgResponseMins.

## Composite indexes (firestore.indexes.json)
- quotations: (vendorId ASC, status ASC, createdAt DESC)
- quotations: (customerId ASC, createdAt DESC)
- bookings: (vendorId ASC, status ASC, eventDate ASC)
- bookings: (customerId ASC, createdAt DESC)
- bookings: (status ASC, eventDate ASC) — reminder job
- vendors: (city ASC, category ASC, rating DESC)
- vendors: (city ASC, category ASC, subscriptionTier ASC, rating DESC) — paid tiers float up
- reviews: (vendorId ASC, createdAt DESC)

## Design notes
- **Search**: Firestore cannot do text search or "near me". MVP: filter by
  (city, category) + sort by rating. Add Algolia/Typesense when vendors > ~500.
- **Counters** (reviewCount, helpfulVotes): fine as transactions until ~1 write/sec
  per doc; shard only if a vendor ever exceeds that.
- **TTL policies** (GCP console → Firestore → TTL): `expiresAt` on quotations;
  consider 18 months on analytics days.
