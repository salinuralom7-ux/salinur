/**
 * MySheher — Web Push sender.
 *
 * The database never talks to a push service itself. A trigger drops a row
 * into push_outbox and this drains it, so a booking is never held up waiting
 * on Google's or Apple's servers, and nothing is lost when they are slow.
 *
 * Deploy:   supabase functions deploy push --no-verify-jwt
 * Secrets:  supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:hello.mysheher@gmail.com
 * Trigger:  Database Webhook on push_outbox INSERT, plus a one-minute cron
 *           sweep so a failed send is retried rather than forgotten.
 *
 * --no-verify-jwt is deliberate: the webhook and the cron job call this
 * without a user JWT. It is safe because the function reads nothing from the
 * request body — it only ever drains the queue.
 */
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello.mysheher@gmail.com";

type Row = {
  id: number; title: string; body: string;
  url: string | null; tag: string | null;
  endpoint: string; p256dh: string; auth: string;
};

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

Deno.serve(async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: "VAPID keys are not set — see DEPLOY.md" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let rows: Row[];
  try {
    rows = (await rpc<Row[]>("claim_push", { p_limit: 40 })) ?? [];
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
  if (!rows.length) return json({ sent: 0, note: "queue empty" });

  let sent = 0, dropped = 0, failed = 0;

  await Promise.all(rows.map(async (r) => {
    const subscription = {
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth },
    };
    const payload = JSON.stringify({
      title: r.title,
      body: r.body,
      url: r.url ?? "./?src=push#inbox",
      tag: r.tag ?? "repto",
    });
    try {
      // TTL: a booking alert that arrives four hours late is worse than none.
      await webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: "high" });
      await rpc("mark_push_sent", { p_id: r.id });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // the browser threw this subscription away; keeping it guarantees
        // a failure every time from here on
        await rpc("drop_push_endpoint", { p_endpoint: r.endpoint });
        await rpc("mark_push_sent", { p_id: r.id });
        dropped++;
      } else {
        await rpc("mark_push_failed", { p_id: r.id, p_error: String(e) });
        failed++;
      }
    }
  }));

  return json({ sent, dropped, failed });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
