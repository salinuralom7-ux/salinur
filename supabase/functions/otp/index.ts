/**
 * MySheher — one-time code sender.
 *
 * Same shape as the push sender, and for the same reason: the database drops
 * a row into otp_outbox and never waits on a third party. This drains it.
 *
 * Deploy:  supabase functions deploy otp --no-verify-jwt
 *
 * Secrets — set the pair for whichever provider you have. Nothing else here
 * needs to change; the function picks by which secrets exist.
 *
 *   WhatsApp Cloud API (Meta), the one to prefer in India:
 *     supabase secrets set WA_TOKEN=... WA_PHONE_ID=... WA_TEMPLATE=mysheher_code
 *
 *   Twilio, as SMS or WhatsApp:
 *     supabase secrets set TWILIO_SID=... TWILIO_TOKEN=... TWILIO_FROM=+1...
 *     (prefix TWILIO_FROM with "whatsapp:" to send on WhatsApp instead of SMS)
 *
 * Then tell the database a provider exists, or send_otp keeps answering
 * "no-provider" and the app keeps saying so honestly rather than pretending:
 *     select public.admin_set_otp('<admin pin>', 'whatsapp');
 *
 * --no-verify-jwt is deliberate and safe for the same reason as push: this
 * reads nothing from the request body. It only ever drains the queue.
 *
 * A note on the WhatsApp template. Meta will not let a business start a
 * conversation with free text — it has to be an approved template, and
 * authentication templates are a category of their own with a fixed shape:
 * one body variable, which is the code. Create it in WhatsApp Manager as
 * category "Authentication", name it to match WA_TEMPLATE, and Meta approves
 * those in minutes rather than days. Do not try to send the code as ordinary
 * text; it will be rejected and the worker will never know why.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WA_TOKEN    = Deno.env.get("WA_TOKEN") ?? "";
const WA_PHONE_ID = Deno.env.get("WA_PHONE_ID") ?? "";
const WA_TEMPLATE = Deno.env.get("WA_TEMPLATE") ?? "mysheher_code";
const WA_LANG     = Deno.env.get("WA_LANG") ?? "en";

const TW_SID   = Deno.env.get("TWILIO_SID") ?? "";
const TW_TOKEN = Deno.env.get("TWILIO_TOKEN") ?? "";
const TW_FROM  = Deno.env.get("TWILIO_FROM") ?? "";

type Row = { id: number; phone: string; code: string };

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

/* Every number in the database is ten digits, because that is what the app
   asks for and what send_otp enforces. The wire wants E.164. */
const e164 = (phone: string) => "91" + phone.replace(/\D/g, "").slice(-10);

async function sendWhatsApp(phone: string, code: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: e164(phone),
      type: "template",
      template: {
        name: WA_TEMPLATE,
        language: { code: WA_LANG },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          /* An authentication template's button is a one-tap copy. Meta
             rejects the message if the button is declared without its
             parameter, and rejects it the other way round too, so both halves
             live here together. */
          { type: "button", sub_type: "url", index: "0",
            parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendTwilio(phone: string, code: string) {
  const wa = TW_FROM.startsWith("whatsapp:");
  const to = wa ? `whatsapp:+${e164(phone)}` : `+${e164(phone)}`;
  const body = new URLSearchParams({
    To: to, From: TW_FROM,
    Body: `${code} is your MySheher code. It lasts 10 minutes. Never share it with anyone — MySheher will never ask you for it.`,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TW_SID}:${TW_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

Deno.serve(async () => {
  const haveWa = !!(WA_TOKEN && WA_PHONE_ID);
  const haveTw = !!(TW_SID && TW_TOKEN && TW_FROM);
  if (!haveWa && !haveTw) {
    return json({ error: "No provider configured — set WA_TOKEN/WA_PHONE_ID or the TWILIO_* trio" }, 500);
  }

  let rows: Row[];
  try {
    rows = (await rpc<Row[]>("claim_otp", { p_limit: 20 })) ?? [];
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
  if (!rows.length) return json({ sent: 0, note: "queue empty" });

  let sent = 0, failed = 0;
  for (const r of rows) {
    try {
      /* WhatsApp first when it is available, because that is where a phone in
         Guwahati actually buzzes — and fall back to Twilio rather than
         dropping the code, since somebody is watching a screen for it. */
      if (haveWa) {
        try { await sendWhatsApp(r.phone, r.code); }
        catch (e) { if (!haveTw) throw e; await sendTwilio(r.phone, r.code); }
      } else {
        await sendTwilio(r.phone, r.code);
      }
      await rpc("mark_otp_sent", { p_id: r.id });
      sent++;
    } catch (e) {
      failed++;
      /* The error is recorded, never the code. claim_otp bumps attempts on
         the way out, so three failures retire the row by itself. */
      try { await rpc("mark_otp_failed", { p_id: r.id, p_error: String(e) }); } catch (_) { /* ignore */ }
    }
  }
  return json({ sent, failed });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
