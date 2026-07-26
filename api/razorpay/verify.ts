import { credentials, fetchPayment, json, notConfigured, verifyPaymentSignature } from '../_lib/razorpay';

/**
 * Confirms that a payment reported by the browser really happened.
 *
 * Checkout hands the browser three values on success. Only the server can tell
 * whether they are genuine, because only the server holds the key secret that
 * the signature is keyed with. The order is treated as paid only after this
 * route returns `verified: true`.
 */

interface VerifyRequest {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const creds = credentials();
  if (!creds) return notConfigured();

  let body: VerifyRequest;
  try {
    body = (await request.json()) as VerifyRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return json({ error: 'missing_fields', verified: false }, 400);
  }

  const valid = await verifyPaymentSignature(creds.keySecret, orderId, paymentId, signature);
  if (!valid) {
    return json({ verified: false, error: 'signature_mismatch' }, 400);
  }

  // The signature proves the values came from Razorpay. Ask the API what state
  // the payment is actually in, so an authorised-but-uncaptured payment is not
  // mistaken for a completed one.
  const payment = await fetchPayment(creds, paymentId);

  return json({
    verified: true,
    paymentId,
    orderId,
    status: payment?.status ?? 'unknown',
    method: payment?.method,
    amount: payment?.amount,
  });
}
