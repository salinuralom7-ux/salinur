# Turning on "Forgotten your PIN?"

Everything on our side is built, deployed and tested. The queue table, the
code generator, the edge function, the retry logic, the CI step that stores
the credentials — all live. What is missing is an account with a company that
can actually put a message on somebody's phone, and that account has to be
created by you: it needs your identity, your business details and a phone
number you own. Nobody else can do that part, including me.

When two values land in this repository's Actions secrets, everything else
happens by itself. This page is the shortest path to those two values.

---

## First, a decision you should not make by accident

**+91 70865 99367 is the number the app publishes to customers.** If it is
currently signed in to the WhatsApp Business *app* on a phone, and you move it
to the WhatsApp Cloud API, **it stops working in that app**. Chats do not come
to the phone any more; they arrive over the API and nowhere else. That is not
reversible in an afternoon.

So pick one:

| | |
|---|---|
| **Use a second number** for codes and leave 70865 99367 on the phone | ← recommended |
| Move 70865 99367 to the Cloud API and answer customers through it | only if you are ready to stop using the WhatsApp app for the business |

A spare SIM, or any number that can receive one verification call, is enough.
Customers never see it — it only sends the six-digit code.

---

## The WhatsApp Cloud API path

This is the one to take in India. WhatsApp needs no DLT registration with the
telecom regulator, which SMS does — that alone is days of paperwork. Meta's
free tier is far more than MySheher will use at this size.

**1. Create the app** — <https://developers.facebook.com/apps> → Create App →
type **Business** → add the **WhatsApp** product. It will make a Meta Business
account for you if you have not got one.

**2. Add your number** — in the WhatsApp panel, *API Setup* → *Add phone
number*. Verify it by SMS or call. Note the **Phone number ID** shown on that
page: a long number, and it is **not** the phone number itself. That is
`WA_PHONE_ID`.

**3. Make the template** — WhatsApp Manager → *Message templates* → *Create*:

- Category: **Authentication** — not Utility, not Marketing. Authentication
  templates are approved in minutes; the others take days and would be
  rejected for this use anyway.
- Name: **`mysheher_code`** (lowercase, underscore). If you name it something
  else, add that name as a third secret called `WA_TEMPLATE`.
- Language: English. Either "English" or "English (US)" is fine — the sender
  tries both.
- Meta writes the body for you. You cannot write your own text for an
  authentication template, and you do not want to: the fixed wording is what
  makes it get approved.
- The copy-code button is optional. On or off, both work.

**4. Get a permanent token** — the token shown on the API Setup page **expires
in 24 hours**. Do not use it. Instead: Business Settings → *System users* →
Add → give it the **Admin** role → *Generate new token* → pick your app →
tick **`whatsapp_business_messaging`** and **`whatsapp_business_management`** →
set expiry to **Never**. That long string is `WA_TOKEN`.

**5. Put them in the repository** —
<https://github.com/salinuralom7-ux/salinur/settings/secrets/actions> →
*New repository secret*, twice:

| Name | Value |
|---|---|
| `WA_TOKEN` | the permanent token from step 4 |
| `WA_PHONE_ID` | the Phone number ID from step 2 |
| `WA_TEMPLATE` | only if you did not call the template `mysheher_code` |

**6. Re-run the workflow** — Actions → *Set up the MySheher database* → *Run
workflow*. Push any commit and it runs anyway.

That run stores the credentials in Supabase, sets `otp_provider = 'whatsapp'`
in the database, and calls the sender once. Check
`.github/mysheher-setup-status.txt` afterwards: the line that today reads
`otp provider: none configured` will name the provider instead.

---

## Never paste a token into a chat

Not to me, not to anyone. A WhatsApp token can send messages as MySheher to
anybody, and a token that has been in a chat window has to be treated as
burned. GitHub Actions secrets are write-only once saved — even you cannot
read them back, which is the point. Every value is masked in the workflow log.

---

## The other path, and why it is second

Twilio works and the sender supports it (`TWILIO_SID`, `TWILIO_TOKEN`,
`TWILIO_FROM`). But **SMS to Indian numbers requires DLT registration** with
the telecom regulator — the sender ID and the message template both have to be
registered, and that is days, not minutes. Twilio's own WhatsApp channel
avoids DLT but still ends at Meta, so you would be doing step 3 regardless.

Prefix `TWILIO_FROM` with `whatsapp:` to send over WhatsApp instead of SMS.

If both are configured, WhatsApp is tried first and Twilio catches anything it
drops.

---

## Does this block launch?

No — and it is worth being clear about which part is degraded.

- **Signing up does not need a code.** `require_phone_otp` is off, so a new
  service expert registers and starts working with no message involved.
- **Signing in does not need a code.** Phone and PIN, nothing else.
- **Only forgetting your PIN needs one.** Until a provider exists, that screen
  says so plainly and gives the WhatsApp number to ask on, and you can reset
  the PIN by hand — `RESET-A-PIN.md` at the root of this repository is the
  four-line procedure.

So the cost of launching without it is that PIN resets are manual and go
through you. At the number of people you will have in week one that is
minutes of work; at a thousand it is a job. Get it done, but do not hold the
launch for it.

---

## What is already proven

`tests/test-otp-send.js` runs the real `supabase/functions/otp/index.ts`
against a fake Meta Graph API in four configurations — template with and
without the copy-code button, language saved as `en` and as `en_US` — and
checks a code gets through all four, addressed in E.164, sent as a template
rather than free text, with the code as the single body variable. It also
checks that an expired token fails immediately instead of being retried at
Meta six times, and that Twilio works as the fallback.

That is why the two secrets should be enough on the first attempt. It does not
prove an account exists; nothing here can.
