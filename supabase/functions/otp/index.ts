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
 *   Email, which needs no phone number at all — the reason it exists here is
 *   that the WhatsApp Cloud API takes over whatever number you give it and
 *   stops that number working in the WhatsApp app, and there was no spare SIM:
 *     supabase secrets set RESEND_KEY=re_... MAIL_FROM="MySheher <codes@mysheher.com>"
 *     It reaches only people who gave an email address at registration, which
 *     is far from all of them. send_otp answers "no-email" for the rest and
 *     the app tells them to ask on WhatsApp instead of pretending.
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

const RESEND_KEY = Deno.env.get("RESEND_KEY") ?? "";
const MAIL_FROM  = Deno.env.get("MAIL_FROM") ?? "MySheher <codes@mysheher.com>";

type Row = { id: number; phone: string; code: string; email: string | null };

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

/* ---------- WhatsApp ----------
   Two things about a Meta authentication template are decided when it is
   created in WhatsApp Manager, not here, and getting either wrong means Meta
   refuses the message with a number rather than a sentence:

     the copy-code button — an authentication template usually has one, and
     then the message MUST declare it with the code as its parameter. Created
     without one, declaring it is an error. Both ways round are rejected.

     the language code — the same template is "en" for some accounts and
     "en_US" for others, depending on which was picked in the dropdown.

   Rather than make somebody discover that from error 132000 at launch, try
   the shapes until one is accepted, and remember which worked so the rest of
   the queue goes straight there. Meta has not accepted the message in any of
   the failing cases, so nothing is ever sent twice. */
type Shape = { lang: string; button: boolean };
let waShape: Shape | null = null;

/* the errors that mean "the template does not look like that" — anything else
   (a dead token, a number not registered) is not fixed by trying again */
const RESHAPE = new Set([100, 132000, 132001, 132005, 132012, 132015]);

function waShapes(): Shape[] {
  const out: Shape[] = [];
  for (const lang of [...new Set([WA_LANG, "en", "en_US"])])
    for (const button of [true, false]) out.push({ lang, button });
  return out;
}

async function waPost(phone: string, code: string, s: Shape) {
  const components: unknown[] = [{ type: "body", parameters: [{ type: "text", text: code }] }];
  if (s.button) {
    components.push({ type: "button", sub_type: "url", index: "0",
                      parameters: [{ type: "text", text: code }] });
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: e164(phone),
      type: "template",
      template: { name: WA_TEMPLATE, language: { code: s.lang }, components },
    }),
  });
  if (res.ok) return null;
  const text = (await res.text()).slice(0, 400);
  let num = 0;
  try { num = JSON.parse(text)?.error?.code ?? 0; } catch { /* not JSON */ }
  return { status: res.status, num, text };
}

async function sendWhatsApp(phone: string, code: string) {
  const all = waShapes();
  const tries = waShape
    ? [waShape, ...all.filter((s) => s.lang !== waShape!.lang || s.button !== waShape!.button)]
    : all;
  let last: { status: number; num: number; text: string } | null = null;
  for (const s of tries) {
    const err = await waPost(phone, code, s);
    if (!err) { waShape = s; return; }
    last = err;
    /* a rejected token or an unauthorised number is not a template problem */
    if (err.status === 401 || err.status === 403) break;
    if (!RESHAPE.has(err.num)) break;
  }
  throw new Error(`whatsapp ${last?.status}: ${last?.text}`);
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

/* ---------- email ----------
   Deliberately plain. A one-time code is read in two seconds on a phone, so
   there is nothing here to lay out and nothing to load: no images, no
   tracking pixel, no unsubscribe footer on a message somebody just asked for.
   The plain-text part is not an afterthought either — a code that arrives as
   an empty message because images are off is worse than no code. */
function codeEmail(code: string) {
  const text =
    `${code} is your MySheher code.\n\n` +
    `It lasts ten minutes. Never share it with anyone — MySheher will never ask you for it.\n\n` +
    `If you did not ask to reset your PIN, you can ignore this message; nobody can get in without the code.\n`;
  const html =
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;color:#15151A">` +
    `<p style="margin:0 0 18px">Your MySheher code is</p>` +
    `<p style="margin:0 0 18px;font-size:34px;font-weight:800;letter-spacing:.16em">${code}</p>` +
    `<p style="margin:0 0 12px">It lasts ten minutes. <b>Never share it with anyone</b> — MySheher will never ask you for it.</p>` +
    `<p style="margin:0;color:#6b6b76;font-size:14px">If you did not ask to reset your PIN you can ignore this; ` +
    `nobody can get in without the code.</p></div>`;
  return { text, html };
}

async function sendEmail(to: string, code: string) {
  const { text, html } = codeEmail(code);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject: `${code} is your MySheher code`,
      text, html,
    }),
  });
  if (!res.ok) throw new Error(`email ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

Deno.serve(async () => {
  const haveWa = !!(WA_TOKEN && WA_PHONE_ID);
  const haveTw = !!(TW_SID && TW_TOKEN && TW_FROM);
  const haveMail = !!RESEND_KEY;
  if (!haveWa && !haveTw && !haveMail) {
    return json({ error: "No provider configured — set RESEND_KEY, WA_TOKEN/WA_PHONE_ID, or the TWILIO_* trio" }, 500);
  }

  let rows: Row[];
  try {
    rows = (await rpc<Row[]>("claim_otp", { p_limit: 20 })) ?? [];
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
  if (!rows.length) return json({ sent: 0, note: "queue empty" });

  let sent = 0, failed = 0, noAddress = 0;
  for (const r of rows) {
    try {
      /* WhatsApp first when it is available, because that is where a phone in
         Guwahati actually buzzes — then Twilio, then email. Falling through
         rather than dropping the code, since somebody is watching a screen
         for it. Email last because it is the one that reaches fewest people:
         a good many service experts here never gave an address. */
      if (haveWa) {
        try { await sendWhatsApp(r.phone, r.code); }
        catch (e) {
          if (haveTw) await sendTwilio(r.phone, r.code);
          else if (haveMail && r.email) await sendEmail(r.email, r.code);
          else throw e;
        }
      } else if (haveTw) {
        await sendTwilio(r.phone, r.code);
      } else if (r.email) {
        await sendEmail(r.email, r.code);
      } else {
        /* send_otp checks for an address before queueing, so this is a race
           rather than the normal path — somebody cleared their email between
           asking for the code and this running. Retrying cannot help. */
        noAddress++;
        await rpc("mark_otp_failed", { p_id: r.id, p_error: "no email address on this profile" });
        continue;
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
  return json({ sent, failed, noAddress });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
