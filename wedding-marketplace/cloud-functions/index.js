/**
 * Wedding Marketplace — Cloud Functions (Firebase Functions v2, Node 20)
 *
 * Money rules enforced here, not in the apps:
 *  - All amounts are integer paise.
 *  - bookings/ and payments/ are written ONLY by these functions.
 *  - Webhooks are verified with the webhook secret and processed idempotently
 *    (payment doc ID = razorpay payment ID), because Razorpay retries deliveries.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onValueCreated } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');
const Razorpay = require('razorpay');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'asia-south1', maxInstances: 20 });

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

const COMMISSION_RATE = 0.15;

/* ------------------------------------------------------------------ */
/* Notification helper: multi-device, prunes dead tokens               */
/* ------------------------------------------------------------------ */
async function notifyUser(collection, uid, title, body, data = {}) {
  const ref = db.collection(collection).doc(uid);
  const snap = await ref.get();
  const tokens = snap.exists ? snap.data().fcmTokens || [] : [];
  if (tokens.length === 0) return;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    android: { priority: 'high' },
    apns: { headers: { 'apns-priority': '10' } },
  });

  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && ['messaging/registration-token-not-registered',
      'messaging/invalid-registration-token'].includes(r.error?.code)) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length) {
    await ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead) });
  }
}

const dateKey = (d) => {
  const dt = d.toDate ? d.toDate() : new Date(d);
  return { month: dt.toISOString().slice(0, 7), day: String(dt.getUTCDate()) };
};

/* ------------------------------------------------------------------ */
/* 1. createBooking — customer accepted a quote                        */
/*    Locks the date, creates the Razorpay order + pending booking.    */
/* ------------------------------------------------------------------ */
exports.createBooking = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET], enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
    const customerId = request.auth.uid;
    const { quoteId } = request.data;
    if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId required');

    const rzp = new Razorpay({
      key_id: RAZORPAY_KEY_ID.value(),
      key_secret: RAZORPAY_KEY_SECRET.value(),
    });

    const bookingRef = db.collection('bookings').doc();

    // Transaction: validate quote, lock the vendor's date, freeze the price.
    const txnResult = await db.runTransaction(async (txn) => {
      const quoteSnap = await txn.get(db.collection('quotations').doc(quoteId));
      if (!quoteSnap.exists) throw new HttpsError('not-found', 'Quote not found');
      const quote = quoteSnap.data();

      if (quote.customerId !== customerId) {
        throw new HttpsError('permission-denied', 'Not your quotation');
      }
      if (quote.status !== 'quoted' || !quote.quotedPrice) {
        throw new HttpsError('failed-precondition', 'Quote is not accept-able');
      }

      const { month, day } = dateKey(quote.eventDate);
      const availRef = db.collection('vendors').doc(quote.vendorId)
        .collection('availability').doc(month);
      const availSnap = await txn.get(availRef);
      const days = availSnap.exists ? availSnap.data().days || {} : {};
      if (days[day] === 'booked' || days[day] === 'blocked') {
        throw new HttpsError('failed-precondition', 'Vendor no longer free on that date');
      }

      const amount = quote.quotedPrice;
      const commission = Math.round(amount * COMMISSION_RATE);

      txn.set(bookingRef, {
        customerId,
        vendorId: quote.vendorId,
        quoteId,
        customerName: quote.customerName,
        vendorName: quote.vendorName,
        category: quote.category,
        eventDate: quote.eventDate,
        amount,
        commissionRate: COMMISSION_RATE,
        commission,
        vendorPayout: amount - commission,
        status: 'pending_payment',
        paymentStatus: 'pending',
        razorpayOrderId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      txn.update(quoteSnap.ref, { status: 'accepted', respondedAt: admin.firestore.FieldValue.serverTimestamp() });
      // Hold the date while payment is pending (released on failure/timeout).
      txn.set(availRef, { days: { ...days, [day]: 'booked' } }, { merge: true });

      return { amount, vendorId: quote.vendorId };
    });

    // Razorpay order (outside the transaction — network call).
    const order = await rzp.orders.create({
      amount: txnResult.amount,
      currency: 'INR',
      receipt: bookingRef.id,
      notes: { bookingId: bookingRef.id, customerId, vendorId: txnResult.vendorId },
    });
    await bookingRef.update({ razorpayOrderId: order.id });

    // Inbox doc so chat is ready the moment the booking exists.
    const convId = `${txnResult.vendorId}_${customerId}`;
    await db.collection('conversations').doc(convId).set({
      participants: [txnResult.vendorId, customerId],
      bookingId: bookingRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { bookingId: bookingRef.id, razorpayOrderId: order.id, amount: txnResult.amount };
  });

/* ------------------------------------------------------------------ */
/* 2. razorpayWebhook — payment.captured / payment.failed / refunds    */
/*    Verified with the WEBHOOK secret over the raw body. Idempotent.  */
/* ------------------------------------------------------------------ */
exports.razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET] },
  async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET.value())
      .update(req.rawBody) // raw body, not re-serialized JSON
      .digest('hex');
    if (!signature ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      res.status(400).send('invalid signature');
      return;
    }

    const event = req.body;
    try {
      if (event.event === 'payment.captured') {
        await handlePaymentCaptured(event.payload.payment.entity);
      } else if (event.event === 'payment.failed') {
        await handlePaymentFailed(event.payload.payment.entity);
      } else if (event.event === 'subscription.charged') {
        await handleSubscriptionCharged(event.payload.subscription.entity);
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('webhook error', err);
      res.status(500).send('retry'); // Razorpay retries on 5xx; handlers are idempotent
    }
  });

async function handlePaymentCaptured(payment) {
  const paymentRef = db.collection('payments').doc(payment.id); // ID = idempotency key
  const bookingId = payment.notes?.bookingId;
  if (!bookingId) return;

  const result = await db.runTransaction(async (txn) => {
    const paySnap = await txn.get(paymentRef);
    if (paySnap.exists) return null; // duplicate delivery — already processed

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await txn.get(bookingRef);
    if (!bookingSnap.exists) throw new Error(`booking ${bookingId} missing`);
    const booking = bookingSnap.data();

    txn.set(paymentRef, {
      bookingId,
      customerId: booking.customerId,
      vendorId: booking.vendorId,
      amount: payment.amount,
      platformFee: booking.commission,
      vendorReceives: booking.vendorPayout,
      razorpayOrderId: payment.order_id,
      method: payment.method,
      status: 'captured',
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      payout: { status: 'pending' },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    txn.update(bookingRef, {
      status: 'confirmed',
      paymentStatus: 'paid',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return booking;
  });

  if (result) {
    const rupees = `₹${Math.round(result.amount / 100).toLocaleString('en-IN')}`;
    await Promise.all([
      notifyUser('vendors', result.vendorId, 'Booking confirmed 🎉',
        `${rupees} from ${result.customerName} is paid. Check your calendar.`,
        { type: 'booking_confirmed', bookingId }),
      notifyUser('customers', result.customerId, 'Payment successful ✓',
        `Your booking with ${result.vendorName} is confirmed.`,
        { type: 'booking_confirmed', bookingId }),
    ]);
  }
}

async function handlePaymentFailed(payment) {
  const bookingId = payment.notes?.bookingId;
  if (!bookingId) return;
  const bookingRef = db.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists || snap.data().paymentStatus === 'paid') return; // capture won the race

  const booking = snap.data();
  // Release the held date.
  const { month, day } = dateKey(booking.eventDate);
  await db.collection('vendors').doc(booking.vendorId)
    .collection('availability').doc(month)
    .set({ days: { [day]: 'free' } }, { merge: true });
  await bookingRef.update({ paymentStatus: 'failed' });
  await notifyUser('customers', booking.customerId, 'Payment failed',
    'Your payment did not go through. Please try again.', { type: 'payment_failed', bookingId });
}

async function handleSubscriptionCharged(subscription) {
  const q = await db.collection('subscriptions')
    .where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
  if (q.empty) return;
  await q.docs[0].ref.update({
    status: 'active',
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_end * 1000),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/* 3. Quotation triggers — the <2s vendor notification                 */
/* ------------------------------------------------------------------ */
exports.onQuotationCreated = onDocumentCreated('quotations/{quoteId}', async (event) => {
  const q = event.data.data();
  await notifyUser('vendors', q.vendorId, 'New enquiry 💍',
    `${q.customerName} wants ${q.category} on ${q.eventDate.toDate().toLocaleDateString('en-IN')}`,
    { type: 'new_quotation', quoteId: event.params.quoteId });
});

exports.onQuotationUpdated = onDocumentUpdated('quotations/{quoteId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === 'open' && after.status === 'quoted') {
    const rupees = `₹${Math.round(after.quotedPrice / 100).toLocaleString('en-IN')}`;
    await notifyUser('customers', after.customerId, 'You received a quote',
      `${after.vendorName} quoted ${rupees}`,
      { type: 'quote_received', quoteId: event.params.quoteId });
  }
});

/* ------------------------------------------------------------------ */
/* 4. Chat push — RTDB message → FCM to the other participant          */
/* ------------------------------------------------------------------ */
exports.onChatMessage = onValueCreated(
  { ref: '/chats/{conversationId}/{messageId}', instance: undefined },
  async (event) => {
    const msg = event.data.val();
    const [vendorId, customerId] = event.params.conversationId.split('_');
    const recipientIsVendor = msg.senderId !== vendorId;
    const collection = recipientIsVendor ? 'vendors' : 'customers';
    const recipient = recipientIsVendor ? vendorId : customerId;
    const preview = msg.type === 'image' ? '📷 Photo' : String(msg.text || '').slice(0, 80);
    await notifyUser(collection, recipient, 'New message', preview,
      { type: 'chat', conversationId: event.params.conversationId });
  });

/* ------------------------------------------------------------------ */
/* 5. submitReview — only after a completed booking                    */
/* ------------------------------------------------------------------ */
exports.submitReview = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const { bookingId, rating, text, photos = [] } = request.data;
  if (!bookingId || !rating || rating < 1 || rating > 5) {
    throw new HttpsError('invalid-argument', 'bookingId and rating 1–5 required');
  }

  await db.runTransaction(async (txn) => {
    const bookingSnap = await txn.get(db.collection('bookings').doc(bookingId));
    if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found');
    const b = bookingSnap.data();
    if (b.customerId !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your booking');
    if (b.status !== 'completed') throw new HttpsError('failed-precondition', 'Booking not completed yet');

    const reviewRef = db.collection('reviews').doc(bookingId); // one review per booking
    const existing = await txn.get(reviewRef);
    if (existing.exists) throw new HttpsError('already-exists', 'Already reviewed');

    const vendorRef = db.collection('vendors').doc(b.vendorId);
    const vendorSnap = await txn.get(vendorRef);
    const v = vendorSnap.data();
    const newCount = (v.reviewCount || 0) + 1;
    const newAvg = ((v.rating || 0) * (v.reviewCount || 0) + rating) / newCount;

    txn.set(reviewRef, {
      vendorId: b.vendorId, customerId: b.customerId, bookingId,
      customerName: b.customerName, rating,
      text: String(text || '').slice(0, 2000), photos: photos.slice(0, 5),
      verified: true, helpfulVotes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    txn.update(vendorRef, { rating: Math.round(newAvg * 10) / 10, reviewCount: newCount });
  });
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* 6. Scheduled jobs                                                   */
/* ------------------------------------------------------------------ */
exports.sendEventReminders = onSchedule(
  { schedule: 'every day 08:00', timeZone: 'Asia/Kolkata' },
  async () => {
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 59, 59, 999);

    const snap = await db.collection('bookings')
      .where('status', '==', 'confirmed')
      .where('eventDate', '>=', start)
      .where('eventDate', '<=', end)
      .get();

    await Promise.all(snap.docs.flatMap((doc) => {
      const b = doc.data();
      return [
        notifyUser('customers', b.customerId, 'Tomorrow is the day! 💍',
          `${b.vendorName} (${b.category}) is booked for tomorrow.`, { type: 'reminder', bookingId: doc.id }),
        notifyUser('vendors', b.vendorId, 'Event tomorrow',
          `${b.category} for ${b.customerName} — be on time!`, { type: 'reminder', bookingId: doc.id }),
      ];
    }));
  });

exports.generateDailyMetrics = onSchedule(
  { schedule: 'every day 23:55', timeZone: 'Asia/Kolkata' },
  async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const key = start.toISOString().slice(0, 10);

    const [created, completed, newCustomers, newVendors] = await Promise.all([
      db.collection('bookings').where('createdAt', '>=', start).get(),
      db.collection('bookings').where('completedAt', '>=', start).get(),
      db.collection('customers').where('createdAt', '>=', start).count().get(),
      db.collection('vendors').where('createdAt', '>=', start).count().get(),
    ]);

    let gmv = 0, commission = 0;
    created.docs.forEach((d) => {
      const b = d.data();
      if (b.paymentStatus === 'paid') { gmv += b.amount; commission += b.commission; }
    });

    await db.doc(`analytics/daily/days/${key}`).set({
      bookingsCreated: created.size,
      bookingsCompleted: completed.size,
      gmv, commission,
      newCustomers: newCustomers.data().count,
      newVendors: newVendors.data().count,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

/* Subscription billing note: Razorpay Subscriptions charges vendors itself on
   the renewal date — there is intentionally no "chargeSubscriptions" cron here.
   We only *react* to `subscription.charged` in the webhook above, and a daily
   sweep below downgrades vendors whose subscription lapsed. */
exports.downgradeLapsedSubscriptions = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Asia/Kolkata' },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const lapsed = await db.collection('subscriptions')
      .where('status', '==', 'active')
      .where('currentPeriodEnd', '<', now)
      .get();
    await Promise.all(lapsed.docs.map(async (doc) => {
      await doc.ref.update({ status: 'past_due', updatedAt: now });
      await db.collection('vendors').doc(doc.id).update({ subscriptionTier: 'free' });
      await notifyUser('vendors', doc.id, 'Subscription expired',
        'Your plan has lapsed — renew to keep your Gold/Platinum benefits.', { type: 'subscription' });
    }));
  });
