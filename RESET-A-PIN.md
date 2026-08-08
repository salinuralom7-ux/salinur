# Resetting somebody's PIN by hand

MySheher has no SMS or WhatsApp provider connected, so the "Forgotten your
PIN?" button cannot send a code. Until one is connected, this is how a person
who is locked out gets back in: you do it for them.

It takes about a minute. Nothing here needs a developer.

---

## Before you touch anything: check it is really them

A PIN reset hands somebody an account. Anyone can claim to be anyone over
WhatsApp, so ask one question only the owner could answer, from their own
profile:

* the exact rate they set for one of their services
* the locality on their profile
* roughly when they registered
* what their profile photo shows

If the answer is wrong or vague, stop. Tell them to write from the WhatsApp
number on the profile and try again. A wrong reset gives a stranger somebody's
livelihood.

---

## The reset

1. Open **supabase.com** and sign in.
2. Choose the **mysheher** project. (It was called "budget-cars" until
   7 August 2026, from before the naming settled. If you are reading an older
   note that says budget-cars, it is the same database.)
3. In the left menu click **SQL Editor**.
4. Click **New query**.
5. Paste the block below.
6. Change the two things in quotes, in **both** places:
   * `9435012345` → their 10-digit number, no +91, no spaces
   * `1234` → the temporary PIN you are giving them
7. Click **Run**.

### For a professional

```sql
insert into worker_secrets (worker_id, pin_hash)
select w.id, extensions.crypt('1234', extensions.gen_salt('bf', 10))
  from workers w where w.phone = '9435012345'
on conflict (worker_id) do update set pin_hash = excluded.pin_hash;

delete from auth_attempts where kind = 'login' and subject = '9435012345';
```

### For a customer

```sql
insert into customer_secrets (customer_id, pin_hash)
select c.id, extensions.crypt('1234', extensions.gen_salt('bf', 10))
  from customers c where c.phone = '9435012345'
on conflict (customer_id) do update set pin_hash = excluded.pin_hash;

delete from auth_attempts where kind = 'login' and subject = '9435012345';
```

The second statement clears the failed-login lockout. Somebody who has been
guessing at their own PIN is often locked out as well as forgotten, and
without this they still cannot get in.

---

## Did it work?

The result panel should say **Success. No rows returned**, or show a row count
of 1. If it says **0 rows**, the number is not on any profile — check for a
typo, and check you used the professional query for a professional and the customer one
for a customer.

If it complains **schema "extensions" does not exist**, remove the two
`extensions.` prefixes and run it again.

---

## Then tell them

> I have reset your PIN to 1234. Open MySheher, sign in with your number and
> that PIN, then change it straight away from your profile.

Use a different temporary PIN each time, and never one that is easy to guess
(not 1234 in real life — 0000, 1111 and 1234 are the first things anybody
tries). Something like 7392.

---

## What this does not do

* It does not touch their profile, their services, their rates or their
  reviews. Only the PIN changes.
* It does not sign them out of a device where they are already signed in.
* It leaves no note on the account. If you want a record of who you reset and
  why, keep it yourself.

---

## When to stop doing this by hand

Once MySheher has a few hundred professionals this becomes a nuisance, and somebody
will be locked out at midnight when you are asleep. At that point connect
**WhatsApp Cloud API** and the "Forgotten your PIN?" button starts working on
its own. See the comment block at the top of `supabase/functions/otp/index.ts`
for exactly what to set — the code is already written and waiting for the
credentials.

Do not use Twilio SMS for Indian numbers. Sending SMS to India requires DLT
registration with a telecom operator, which takes weeks. Meta's WhatsApp path
takes days and is free at this volume.
