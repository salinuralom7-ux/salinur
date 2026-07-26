import type { Address, CartItem, OrderTotals, PaymentMode, PaymentRecord } from '../types';
import { STORE } from '../config';
import { PAYMENTS_MODE } from './env';

/**
 * Browser side of the Razorpay flow.
 *
 * The sequence is: ask our server to open an order, hand the returned order id
 * to Razorpay Checkout, then send whatever Checkout gives back to our server to
 * be verified. The browser never decides how much is owed and never decides
 * whether a payment succeeded — both of those are the server's answer.
 */

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export class PaymentError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
  }
}

/** Raised when the customer closes the Razorpay window without paying. */
export class PaymentCancelled extends PaymentError {
  constructor() {
    super('Payment window was closed before the payment finished.', 'cancelled');
  }
}

export interface PayInput {
  items: CartItem[];
  totals: OrderTotals;
  shippingMethod: 'standard' | 'express';
  paymentMode: PaymentMode;
  promoCode?: string;
  orderRef: string;
  address: Address;
}

interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

/** True when the storefront is running without a live merchant account. */
export interface PayResult {
  payment: PaymentRecord;
  /** Set when the payment was simulated because no gateway is configured. */
  simulated: boolean;
}

async function openServerOrder(input: PayInput): Promise<OrderResponse | 'not-configured'> {
  let response: Response;
  try {
    response = await fetch('/api/razorpay/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: input.items,
        shippingMethod: input.shippingMethod,
        paymentMode: input.paymentMode,
        promoCode: input.promoCode,
        bookingAmount: input.totals.payNow,
        orderRef: input.orderRef,
      }),
    });
  } catch {
    // No server at all — the static build is being previewed on its own.
    return 'not-configured';
  }

  if (response.status === 501 || response.status === 404) return 'not-configured';

  // A static host with a catch-all SPA rewrite answers /api/* with index.html.
  // That is not an error, it means there is no serverless runtime behind this
  // deployment at all — treat it the same as missing keys.
  if (!response.headers.get('content-type')?.includes('application/json')) return 'not-configured';

  const body = (await response.json().catch(() => ({}))) as Partial<OrderResponse> & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new PaymentError(
      body.message ?? 'The payment gateway rejected this order. Please try again.',
      body.error ?? 'gateway_error',
    );
  }

  if (!body.orderId || !body.keyId || typeof body.amount !== 'number') {
    throw new PaymentError('The payment gateway returned an unexpected response.', 'bad_response');
  }

  return { orderId: body.orderId, keyId: body.keyId, amount: body.amount, currency: body.currency ?? 'INR' };
}

async function verify(success: RazorpaySuccess): Promise<{ verified: boolean; status: string }> {
  try {
    const response = await fetch('/api/razorpay/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(success),
    });
    const body = (await response.json()) as { verified?: boolean; status?: string };
    return { verified: body.verified === true, status: body.status ?? 'unknown' };
  } catch {
    return { verified: false, status: 'unreachable' };
  }
}

function simulatedPayment(amount: number): PayResult {
  const stamp = Date.now().toString(36).toUpperCase();
  return {
    simulated: true,
    payment: {
      provider: 'test',
      orderId: `test_order_${stamp}`,
      paymentId: `test_pay_${stamp}`,
      amount,
      verified: false,
      at: new Date().toISOString(),
    },
  };
}

/**
 * Collects `input.totals.payNow` — the full amount for a prepaid order, or the
 * booking charge for cash on delivery.
 */
export async function pay(input: PayInput): Promise<PayResult> {
  const amountDue = input.totals.payNow;

  if (PAYMENTS_MODE === 'demo') return simulatedPayment(amountDue);

  const order = await openServerOrder(input);

  if (order === 'not-configured') {
    if (PAYMENTS_MODE === 'live') {
      throw new PaymentError(
        'Online payment is temporarily unavailable. Please try again shortly.',
        'gateway_not_configured',
      );
    }
    return simulatedPayment(amountDue);
  }

  const loaded = await loadCheckoutScript();
  if (!loaded || !window.Razorpay) {
    throw new PaymentError(
      'Could not reach Razorpay. Check your internet connection and try again.',
      'script_failed',
    );
  }

  const success = await new Promise<RazorpaySuccess>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: STORE.name,
      description:
        input.paymentMode === 'cod'
          ? `Booking charge for order ${input.orderRef}`
          : `Order ${input.orderRef}`,
      order_id: order.orderId,
      prefill: {
        name: input.address.name,
        email: input.address.email,
        contact: input.address.phone,
      },
      notes: { order_ref: input.orderRef, payment_mode: input.paymentMode },
      theme: { color: '#0f5132' },
      handler: resolve,
      modal: { ondismiss: () => reject(new PaymentCancelled()) },
    });

    checkout.on('payment.failed', (payload) => {
      reject(
        new PaymentError(
          payload.error?.description ?? 'The payment could not be completed.',
          'payment_failed',
        ),
      );
    });

    checkout.open();
  });

  const { verified, status } = await verify(success);

  if (!verified) {
    throw new PaymentError(
      'We could not confirm this payment with the bank. If money has left your account it will be refunded automatically within five working days — please contact us before paying again.',
      'verification_failed',
    );
  }

  if (status !== 'captured' && status !== 'authorized') {
    throw new PaymentError(`The payment is in an unexpected state (${status}).`, 'unexpected_status');
  }

  return {
    simulated: false,
    payment: {
      provider: 'razorpay',
      orderId: success.razorpay_order_id,
      paymentId: success.razorpay_payment_id,
      signature: success.razorpay_signature,
      amount: amountDue,
      verified: true,
      at: new Date().toISOString(),
    },
  };
}
