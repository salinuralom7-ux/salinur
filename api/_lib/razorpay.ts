/**
 * Shared helpers for the two Razorpay routes.
 *
 * Written against Web-standard APIs only (Request, Response, fetch, WebCrypto)
 * so the same handlers run unchanged on Vercel's Node runtime, Cloudflare Pages
 * Functions and Netlify Edge.
 */

interface ProcessLike {
  env?: Record<string, string | undefined>;
}

/**
 * Reads a secret from the platform environment. Vercel and Netlify expose
 * `process.env`; on Cloudflare the per-request `env` binding is passed in.
 */
export function readEnv(name: string, bindings?: Record<string, unknown>): string | undefined {
  const fromBinding = bindings?.[name];
  if (typeof fromBinding === 'string' && fromBinding) return fromBinding;

  const proc = (globalThis as { process?: ProcessLike }).process;
  const value = proc?.env?.[name];
  return value && value.length > 0 ? value : undefined;
}

export interface Credentials {
  keyId: string;
  keySecret: string;
}

export function credentials(bindings?: Record<string, unknown>): Credentials | null {
  const keyId = readEnv('RAZORPAY_KEY_ID', bindings);
  const keySecret = readEnv('RAZORPAY_KEY_SECRET', bindings);
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** 501 tells the browser the shop is running before the merchant account is live. */
export function notConfigured(): Response {
  return json(
    {
      error: 'gateway_not_configured',
      message:
        'Razorpay keys are not set on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the deployment environment.',
    },
    501,
  );
}

const encoder = new TextEncoder();

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies the signature Razorpay Checkout hands back to the browser.
 * The digest covers `order_id|payment_id`, keyed with the account secret, so a
 * client cannot fabricate a successful payment.
 */
export async function verifyPaymentSignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256(keySecret, `${orderId}|${paymentId}`);
  return timingSafeEqual(expected, signature.toLowerCase());
}

/** Constant-time string comparison — never short-circuit on a secret. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function basicAuth({ keyId, keySecret }: Credentials): string {
  const raw = `${keyId}:${keySecret}`;
  // btoa is available in every runtime this ships to.
  return 'Basic ' + btoa(raw);
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export async function createRazorpayOrder(
  creds: Credentials,
  body: {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  },
): Promise<{ ok: true; order: RazorpayOrder } | { ok: false; status: number; detail: string }> {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: basicAuth(creds),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, detail: text.slice(0, 500) };
  }

  return { ok: true, order: JSON.parse(text) as RazorpayOrder };
}

export async function fetchPayment(
  creds: Credentials,
  paymentId: string,
): Promise<{ status: string; amount: number; method?: string } | null> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: basicAuth(creds) },
  });
  if (!response.ok) return null;
  return (await response.json()) as { status: string; amount: number; method?: string };
}
