# Getting twelve testers past "Item not found"

Seven of twelve got stuck. This is what to check on your side, and what to
send them. The track is **Closed testing** with a **typed email list**, which
is the right setup — the fourteen-day clock is running, and nothing in Play
Console needs rebuilding.

---

## Send them this, and only this

**<https://mysheher.com/tester>**

Not the Play Store link. A plain Play Store link shows "Item not found" to
anybody who has not already opted in, which is everybody you have just
invited — so it fails for every single person, every single time, and says
nothing about why. That is the whole bug.

The page walks them through the three steps in the order that works, and
answers "Item not found" with the five real causes in the order they actually
happen.

---

## The one that will be biting you

With a typed email list, the commonest failure is not the opt-in step. It is
this:

> **The address you typed is not the account signed in on their phone.**

People give you the address they email you from, or the one on their WhatsApp.
The Play Store uses whichever Google account is signed in on the device. Most
people have two or three, and only the signed-in one can see the app.

So the first thing the tester page asks them to do — before anything else — is
open the Play Store, tap their picture, and read the address under their name.
Ask each of the seven for **exactly that string** and compare it to your list.

Two related traps:

- **It has to be a Google account.** A Yahoo, Outlook or custom-domain address
  that has never been used to sign in with Google cannot be invited at all.
  Play will accept it into the list and it will simply never work.
- **Watch for typos and aliases.** `gmail.com` misspelt, a leading capital, or
  a `+tag` you added. Gmail ignores dots when delivering mail but Play matches
  the string you typed.

---

## The Play Console checklist

**Testing → Closed testing → your track.**

1. **Testers tab** — every one of the twelve is listed, spelled exactly as the
   address on their phone. Press **Save** after any edit; the list does not
   save itself when you navigate away.
2. **Copy the opt-in link from this page** rather than trusting the one on the
   tester page. It should read
   `https://play.google.com/apps/testing/com.mysheher.app`. If Play shows you
   something different, tell me and I will change the button.
3. **Releases tab** — the release must say **Available to testers**, not "In
   review", "Draft" or "Pending publication". A release still in review 404s
   for everyone including you.
4. **Countries / regions** — India must be listed. Anyone abroad cannot
   install, full stop.
5. **Give it time after a change.** Adding a tester or publishing a release
   takes Google a few hours to propagate, sometimes longer. "It didn't work
   immediately" is not evidence of a problem.

---

## The fourteen days

Twelve testers, opted in, **continuously**, for fourteen days. The two ways
this quietly resets:

- somebody presses **Leave the programme** on the opt-in page;
- somebody is removed from the tester list.

Uninstalling the app is not the same as leaving the programme, and is
survivable. Leaving the programme is not. The tester page asks them plainly
not to.

Aim for **fifteen or sixteen** testers rather than exactly twelve, so one
person losing interest does not restart the clock for everyone else.

---

## What to say when you send it

Something like this. Short, and it front-loads the account question, because
that is the answer you actually need back from them.

> MySheher is on the Play Store but still invite-only, so a normal link shows
> "Item not found" for everyone. This page fixes it:
> https://mysheher.com/tester
>
> Before you start — open the Play Store, tap your picture at the top right,
> and send me the email address it shows. That is the one I have to add, and
> it is usually not the one people expect.
>
> One favour: please keep it installed for two weeks. Google needs twelve of
> us on it continuously before the app can go public, and one person leaving
> restarts the count for everybody.

---

## The people who cannot use Play at all

An iPhone, or an Android with no Play Store. Send them to
<https://mysheher.com> and have them add it to the home screen — the website
is the same app, same profiles, same bookings.

Be clear with yourself about this though: **it does not count towards the
twelve.** It is worth doing for real users, and worth nothing for the Play
requirement.
