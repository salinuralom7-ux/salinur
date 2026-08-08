# Uploading MySheher to Google Play — the actual steps

Written for the day you do it. Follow it top to bottom; do not skip step 6,
which is the one that decides whether the app looks service expert or broken.

Everything the listing asks for is in `play-listing.md` next to this file.
Every graphic is in `docs/store/`. Nothing needs to be made up on the spot.

---

## Before you start, have these open

| | |
|---|---|
| Play Console | <https://play.google.com/console> |
| The bundle | `app-release-bundle.aab` from PWABuilder or Bubblewrap |
| The listing text | `store/play-listing.md` |
| The graphics | `docs/store/` |
| The keystore + its password | wherever you backed it up — **not** in this repo |

**The keystore is the one thing that cannot be replaced by anyone.** If you
lose it you can no longer update this listing, ever. Back it up somewhere you
will still have in five years, off the phone. Never paste it into a chat.

---

## 1. Create the app

Play Console → **Create app**.

| Field | Answer |
|---|---|
| App name | `MySheher: Local Service experts Nearby` |
| Default language | English (India) |
| App or game | App |
| Free or paid | **Free** |

Tick both declarations at the bottom, then **Create app**.

> Free cannot be changed to paid later. Free is right — MySheher takes no
> commission and charges nothing to book.

---

## 2. Upload the bundle

**Test and release → Testing → Closed testing → Create new release.**

Not production. A personal Play account opened after November 2023 must run a
closed test with **at least 12 testers for 14 continuous days** before it can
go public, so this track is where the clock starts. Starting it today is the
single most useful thing you can do.

1. Upload `app-release-bundle.aab`.
2. Let Play manage the signing key when it offers — say yes. That is what
   makes a lost upload key survivable.
3. Release name: `1.0.0 (1)`.
4. Release notes: *First release. Find and book local service experts in Guwahati.*

Save. Do not roll it out yet.

---

## 3. Add your testers

Same screen → **Testers** → create an email list, add at least 12 addresses.

Friends, family, the first service experts who register. They must each **accept the
opt-in link and install the app** for the day to count. A tester who never
opens it does not count, so send the link personally and check they did it.

---

## 4. Fill in the store listing

**Grow → Store presence → Main store listing.** Everything is in
`play-listing.md`:

| Field | Where it is |
|---|---|
| App name, short and full description | top of `play-listing.md` |
| App icon (512×512) | `docs/icons/icon-512.png` |
| Feature graphic (1024×500) | `docs/store/feature-graphic.png` |
| Phone screenshots | the five `docs/store/screen-*.png` |
| Category | Lifestyle |
| Email | `info@mysheher.com` |
| Website | `https://mysheher.com/` |
| Privacy policy | `https://mysheher.com/privacy/` |

Minimum is 2 screenshots; there are 5, use all of them.

---

## 5. The forms Play will not let you skip

**Policy → App content.** Work down the list; answers are in
`play-listing.md`.

* **Privacy policy** — `https://mysheher.com/privacy/`
* **App access** — everything is reachable without signing in except a
  service expert's own dashboard. Say so, and give a test service expert's number and PIN so
  the reviewer can get in.
* **Ads** — No.
* **Content rating** — fill in the questionnaire; answers are in
  `play-listing.md`. Expect PEGI 3 / Everyone.
* **Target audience** — **18 and over**. The terms require it.
* **Data safety** — the whole table is in `play-listing.md`. Answer it
  exactly as written. In-app messages **are** collected; saying otherwise is
  the mismatch Play rejects updates over.
* **Government apps** — No.
* **Financial features** — No, none. MySheher handles no money.
* **Health** — No.
* **Account deletion** — `https://mysheher.com/delete-account/`
  Play tests this link. It works without signing in.

---

## 6. The step that decides whether the app looks broken

**Do this after step 2, and it cannot be done before.**

A Trusted Web Activity only opens without a browser address bar if
`mysheher.com` vouches for the app. It does that through
`docs/.well-known/assetlinks.json`, which must list **two** fingerprints:

| Fingerprint | Why |
|---|---|
| **App signing key** | Play re-signs your bundle with its own key. This is what every install from the Play Store is signed with. |
| **Upload key** | Signs what you upload, and what a tester installs from a direct APK. |

Right now that file has **only the upload key**. The app signing key does not
exist until Play generates it, which happens when you upload — which is why
this is step 6 and not step 1.

**What to do:** after the bundle finishes processing, go to
**Test and release → Setup → App integrity → App signing**. You will see two
SHA-256 certificate fingerprints. Copy **both** and send them to me. I will
add them, push, and confirm the file is live — it takes two minutes.

**If you skip this:** the app opens with a browser address bar across the top
on every phone that installs it from Play. It still works. It looks like a
website in a frame, which is the one thing a TWA is supposed to avoid.

---

## 7. Roll out

Back to **Closed testing → your release → Review release → Start rollout**.

First review usually takes a few days. Later updates are faster.

Then leave it running **14 continuous days**. Do not pause the track, do not
delete the release. When the 14 days are up, Play offers to apply for
production access.

---

## What will not work on day one, and why

Be honest with your testers about this — it is one setting, not a bug.

**No notification of any kind will be delivered** until the push keys are set
in Supabase. The queueing is complete and correct: a new booking, an instant
job offer, an appointment, a reminder for a job you accepted and forgot, a
review someone left you — all of it goes into the queue and waits. Nothing
comes out.

Fixing it is one command and about five minutes, and it is written up in
`DEPLOY.md`. Ask me and I will walk you through it.

The same is true of the one-time codes used to recover a forgotten PIN: they
queue, and the app says plainly that no provider is connected rather than
pretending a message is on its way.

---

## If Play rejects it

It happens, and it is not a disaster. The three usual reasons, all avoidable:

1. **Data safety does not match behaviour.** Answer it exactly as
   `play-listing.md` says.
2. **The reviewer could not get in.** Give them a working service expert number and
   PIN under App access.
3. **The listing promises something the app does not do.** The description in
   `play-listing.md` was checked against the app on 5 August 2026.

Send me the rejection text and I will tell you exactly what to change.
