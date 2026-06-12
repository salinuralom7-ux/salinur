# 6 — React Native Integration Guide

Both apps (Customer + Vendor) share ~70% of this code — build a shared package
(`packages/core`) in a monorepo, or copy a `src/firebase/` folder into each app.

## Packages

```bash
npm i @react-native-firebase/app @react-native-firebase/auth \
      @react-native-firebase/firestore @react-native-firebase/database \
      @react-native-firebase/storage @react-native-firebase/messaging \
      @react-native-firebase/functions @react-native-firebase/app-check \
      react-native-razorpay
cd ios && pod install
```

Drop `google-services.json` into `android/app/` and `GoogleService-Info.plist`
into the iOS project (a different one per app — customer vs vendor).

## Phone OTP sign-in

```js
import auth from '@react-native-firebase/auth';

// Step 1 — send OTP (native apps need no recaptcha UI; Play Integrity handles it)
const confirmation = await auth().signInWithPhoneNumber('+91' + phone);
// Step 2 — verify
await confirmation.confirm(otpCode);
// auth().currentUser.uid is now the vendors/{uid} or customers/{uid} doc ID
```

After first sign-in, route to profile creation if the Firestore doc doesn't exist.

## FCM token registration (both apps, on every launch)

```js
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

async function registerPush(collection, uid) {
  await messaging().requestPermission();           // iOS prompt; Android 13+ POST_NOTIFICATIONS
  const token = await messaging().getToken();
  await firestore().collection(collection).doc(uid).update({
    fcmTokens: firestore.FieldValue.arrayUnion(token),
  });
  messaging().onTokenRefresh((t) =>
    firestore().collection(collection).doc(uid).update({
      fcmTokens: firestore.FieldValue.arrayUnion(t),
    }));
}
```

Android: create a high-importance channel once at startup so heads-up
notifications appear (`notifee` or `PushNotification.createChannel`).

## Real-time vendor order screen (the <2s requirement)

The push notification wakes the app; the live list itself is a Firestore listener —
no polling anywhere:

```js
useEffect(() => {
  const unsub = firestore().collection('quotations')
    .where('vendorId', '==', uid)
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snap) => setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  return unsub;
}, [uid]);
```

## Chat (RTDB)

```js
import database from '@react-native-firebase/database';

const cid = `${vendorId}_${customerId}`;
// listen
database().ref(`chats/${cid}`).limitToLast(50)
  .on('child_added', (snap) => appendMessage({ id: snap.key, ...snap.val() }));
// send
await database().ref(`chats/${cid}`).push({
  senderId: uid, text, type: 'text',
  ts: database.ServerValue.TIMESTAMP, read: false,
});
// then update the Firestore inbox doc (lastMessage, unread+1 for the other side)
```

## Booking + Razorpay checkout (customer app)

```js
import functions from '@react-native-firebase/functions';
import RazorpayCheckout from 'react-native-razorpay';

const fn = functions('asia-south1');
const { data } = await fn.httpsCallable('createBooking')({ quoteId });

await RazorpayCheckout.open({
  key: RAZORPAY_KEY_ID,                  // public key only — never the secret
  order_id: data.razorpayOrderId,
  amount: data.amount,                    // paise
  currency: 'INR',
  name: 'Wedding Marketplace',
  prefill: { contact: user.phone },
  theme: { color: '#7c2d5d' },
});
// Do NOT mark anything paid here. The webhook confirms; the app just listens:
firestore().collection('bookings').doc(data.bookingId)
  .onSnapshot((d) => { if (d.data()?.paymentStatus === 'paid') showSuccess(); });
```

This is the key pattern: **the client never decides payment succeeded** — it waits
for the server (webhook → Firestore) to say so.

## Multi-language

Store `locale` on the user doc; use `i18next` with `as`, `bn`, `hi`, `en` JSON
bundles. All money formatting through `Intl.NumberFormat('en-IN')`.
