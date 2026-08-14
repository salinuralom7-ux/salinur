# Turning on "Forgotten your PIN?"

Everything on our side is built, tested and deployed. What is missing is an
account with somebody who delivers messages, and only you can create that.

**We are doing this by email**, because the WhatsApp Cloud API takes over
whatever phone number you give it and stops that number working in the
WhatsApp app. 70865 99367 is your customer number and 7086 269537 is your
personal WhatsApp — neither can be given up, and there is no spare SIM.

---

## Be clear about what this fixes

Email reaches only the service experts who **gave an email address when they
registered**, and that field is optional. Many will not have.

- Somebody with an address gets a code and resets their own PIN.
- Somebody without gets told plainly, with a WhatsApp button to message you,
  and you reset it by hand — `RESET-A-PIN.md` at the root of this repository.

That is a real improvement over today, where nobody can reset anything. It is
not the whole answer. **A ₹150 prepaid SIM plus the WhatsApp route would reach
everybody**, and is still worth doing later.

---

## Twenty minutes, four steps

### 1. Make a Resend account

<https://resend.com> → sign up. Free tier is 3,000 emails a month and 100 a
day, which is far more PIN resets than MySheher will ever have.

### 2. Add mysheher.com as a sending domain

Resend → **Domains** → **Add Domain** → type `mysheher.com` → region
**ap-south-1 (Mumbai)**.

Resend shows you three or four DNS records — a couple of TXT, one MX. Add them
wherever mysheher.com's DNS lives (the registrar you bought the domain from,
not GitHub). Then press **Verify**.

This is the fiddly step and the one that matters: it is what stops the code
landing in spam. Give it up to an hour to verify; usually it is minutes.

> **Do not skip to sending from a resend.dev address.** Those only deliver to
> your own inbox, so every tester would get nothing and you would not know why.

### 3. Create the API key

Resend → **API Keys** → **Create API Key**.

- Name: `mysheher-otp`
- Permission: **Sending access**
- Domain: `mysheher.com`

It shows the key **once**. It starts `re_`.

### 4. Put it in GitHub

<https://github.com/salinuralom7-ux/salinur/settings/secrets/actions> →
**New repository secret**, twice:

| Name | Value |
|---|---|
| `RESEND_KEY` | the `re_…` key from step 3 |
| `MAIL_FROM` | `MySheher <codes@mysheher.com>` |

Then **Actions → Set up the MySheher database → Run workflow**. Pushing any
commit runs it too.

That run stores the key in Supabase, sets `otp_provider = 'email'`, and calls
the sender once. Check `.github/mysheher-setup-status.txt` afterwards — the
line that reads `otp provider: none configured` will say `email` instead.

### Then test it yourself

Your own worker profile has an email on it. Open the app → **Forgotten your
PIN?** → your number → it should say *"We emailed a 6-digit code to
sa••••••••@gmail.com"*. Check the inbox, and the spam folder.

---

## Never paste the key into a chat

Not to me, not to anyone. A Resend key can send email **as MySheher** to
anybody, which is a gift to a phisher. A key that has been in a chat window is
burned and has to be rotated. GitHub Actions secrets are write-only once
saved — even you cannot read them back, which is the point. Every value is
masked in the workflow log.

---

## What is already proven

- `tests/test-otp-send.js` runs the real `supabase/functions/otp/index.ts`
  against a fake Resend: the code reaches the right address, from MySheher,
  with the code in the subject line so it is readable from the notification,
  as plain text as well as HTML, warning never to share it, and carrying no
  tracking pixel and nothing to load.
- Migration 47 is proved against real Postgres: the masked address, the
  "no-email" answer, that an unregistered number gets that same answer so
  this cannot be used to ask which numbers are registered, that nothing
  undeliverable is queued, and that nobody burns one of their five tries an
  hour on a code that was never going to be sent.
- `tests/test-recover-email.js` checks all four things the screen can say.

None of that proves a Resend account exists. Nothing here can.

---

## If you get a spare SIM later

Everything for WhatsApp is still in place and still tested. Add `WA_TOKEN` and
`WA_PHONE_ID` alongside `RESEND_KEY` and the sender tries WhatsApp first,
falling back to email. Nothing needs removing.

The WhatsApp steps are in this file's history, or ask and I will write them
out again.
