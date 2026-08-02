# Publishing MySheher

Everything here is ready to submit. Two things cannot be done from this
repository — creating the developer accounts, and generating a signing key —
because both require your identity and a payment card. They are marked
**YOU** below. Everything else is already written.

Read the honest summary first, because the two stores are not equally close.

| | Google Play | Apple App Store |
|---|---|---|
| Can the site be uploaded as-is? | **Yes** — wrapped as a TWA | **No** |
| What you need | A Play console account (₹2,000 one-off) | A Mac with Xcode + Apple Developer Program (₹9,900/year) |
| Realistic effort from here | An afternoon | A week or two of work |
| Risk of rejection | Low | Real — see the App Store section |

**Suggested order: ship Play now, and let iPhone users install the web app
from Safari in the meantime.** MySheher already installs to an iPhone home
screen and runs full screen; the app explains how the first time an iPhone
visits. That covers iOS users on day one while you build a proper iOS app.

---

## Google Play

### What the app actually is

A Trusted Web Activity: a thin Android shell that opens mysheher.com full
screen, with no browser chrome. Google supports this officially — it is how
Twitter Lite, Trivago and many others ship. Updates to the site are updates
to the app; you only re-upload the bundle when the shell itself changes.

### Step 1 — YOU: Play Console account

1. Go to <https://play.google.com/console> and sign up. It costs **US$25 once**.
2. Choose **Personal** (matches "Salinur Alom, sole proprietor").
3. Complete identity verification. This takes a couple of days, so start it
   before anything else.

Personal accounts opened after November 2023 must run a **closed test with at
least 12 testers for 14 continuous days** before they can go public. Start
gathering those 12 people now — friends, family, the first workers who
register. It is the longest pole in the whole process.

### Step 2 — Build the Android bundle

On any machine with Node 18+ and a JDK:

```bash
npm i -g @bubblewrap/cli
mkdir mysheher-android && cd mysheher-android
cp ../store/twa-manifest.json ./twa-manifest.json
bubblewrap init --manifest https://mysheher.com/manifest.webmanifest
bubblewrap build
```

`bubblewrap init` asks a few questions; the answers are already in
`twa-manifest.json` next to this file, so accept its values. It produces:

* `app-release-bundle.aab` — what you upload to Play
* `android.keystore` — **YOU: back this up somewhere safe.** Lose it and you
  can never update the app under the same listing.

### Step 3 — Prove the site and the app belong together

Without this the app opens with a browser address bar across the top, which
looks broken.

`assetlinks.json` holds **two** fingerprints, and both are needed:

| Fingerprint | Where it comes from | Why |
|---|---|---|
| App signing key | Play Console → App integrity → *App signing key certificate* | Play re-signs the bundle with its own key. This is what installs from the store are signed with. |
| Upload key | the same page, *Upload key certificate* — also printed in the PWABuilder zip | Signs what you upload, and what a tester installs from a direct APK. |

Listing only the first breaks sideloaded test builds; listing only the second
breaks every install from the store. Google's own tooling emits both.

1. Copy both from Play Console → **Test and release → Setup → App integrity**.
2. Put them in `docs/.well-known/assetlinks.json`, replacing
   `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` and `REPLACE_WITH_UPLOAD_KEY_SHA256`.
3. Commit and push. Confirm it is live:
   `curl https://mysheher.com/.well-known/assetlinks.json`
4. Verify with
   <https://developers.google.com/digital-asset-links/tools/generator>.

### The signing key, which is the one thing you cannot re-create

PWABuilder's zip contains `signing.keystore` and a `signing-key-info.txt`
holding its password. Treat both the way you treat a bank PIN:

* back them up somewhere you will still have in five years, off the phone;
* never commit them to this repository, which is public;
* never paste them into a chat, an email, or a screenshot.

If the upload key does leak, it is recoverable — Play lets you register a new
upload key. The *app signing* key held by Google is the one that could never
be replaced, which is exactly why letting Play hold it is the right choice.

### Step 4 — Fill in the listing

Everything you need to paste is in [`play-listing.md`](play-listing.md):
title, short and full description, category, contact details, the Data safety
answers, and the content rating questionnaire answers.

Graphics are already generated and live in `docs/store/`:

| Asset | File | Size |
|---|---|---|
| Feature graphic | `feature-graphic.png` | 1024 × 500 |
| Phone screenshots | `screen-home.png`, `screen-browse.png`, `screen-search.png`, `screen-worker.png`, `screen-register.png` | 1080 × 1920 |
| App icon | `docs/icons/icon-512.png` | 512 × 512 |

Regenerate them any time the app changes:
`node tests/make-store-assets.js`.

The icon itself is not hand-made. Every square icon, the header mark and the
wordmark are cut from `brand/` by `python3 tools/make-brand.py`, so the icon on
a phone can never drift from the logo in the app. Change the artwork, re-run
that, then re-run the store assets — and bump the `?v=` on the icon URLs, or
already-installed phones keep showing the old icon.

### Step 5 — URLs Play will ask for

| Field | Value |
|---|---|
| Privacy policy | `https://mysheher.com/privacy/` |
| Account deletion | `https://mysheher.com/delete-account/` |
| Support email | `info@mysheher.com` |
| Website | `https://mysheher.com/` |

The account deletion URL is mandatory for any app that lets people create an
account, and it must work without signing in. Ours does.

### Step 6 — Closed test, then production

1. Upload the `.aab` to a **Closed testing** track.
2. Add your 12+ testers by email address.
3. Leave it running **14 days without a gap**. Google counts continuous days.
4. Apply for production access, then submit.

First review usually takes a few days. Later updates are faster.

---

## Apple App Store

### Read this before spending money

Apple does not accept a website or a PWA as an app submission. There is no
upload path — you need a real `.ipa`, built on macOS with Xcode, signed with
an Apple Developer Program certificate (**₹9,900/year, renewed annually**).

More importantly, **App Store Review Guideline 4.2 (Minimum Functionality)**
exists precisely to reject apps that are a web view around a website. A
Capacitor wrapper with nothing else in it is very likely to be rejected, and
each rejection costs a review cycle.

That is not a reason to skip iOS. It is a reason to submit something that
earns its place on the home screen.

### What would make it pass

Build these before submitting, not after a rejection:

1. **Push notifications.** The single strongest argument. A worker learns
   about a booking the moment it arrives instead of hunting through WhatsApp;
   a customer hears back when a worker accepts. This alone answers 4.2.
2. **Native camera** for the verification photo, via
   `@capacitor/camera` rather than the web `getUserMedia` path.
3. **Contacts / share sheet** so a booking can be shared natively.
4. **Offline behaviour** — the service worker already does most of this.
5. **Sign in with Apple** — required by Guideline 4.8 *only if* you add
   third-party logins such as Google or Facebook. MySheher uses a phone number
   and PIN, so this does not apply today. Keep it that way and you save the
   work.

### The build path

```bash
npm i @capacitor/core @capacitor/cli
npx cap init MySheher com.mysheher.app --web-dir=docs
npx cap add ios
npx cap open ios        # requires macOS + Xcode
```

Point the app at the live site with `server.url = "https://mysheher.com"` in
`capacitor.config.json`, or bundle `docs/` and let it run locally — bundling
is better for review, because Apple dislikes an app whose entire content is
remote.

No Mac? **Codemagic** and **Ionic Appflow** both build and sign iOS apps in
the cloud from a repository, on free or cheap tiers. You still need the
Apple Developer Program membership.

### Apple also asks for

| Field | Value |
|---|---|
| Privacy policy URL | `https://mysheher.com/privacy/` |
| Support URL | `https://mysheher.com/about/#contact` |
| Account deletion | Must be reachable in-app — it is, under *My profile* |
| Age rating | 17+ — see the rating notes in `play-listing.md` |
| Encryption | Uses HTTPS only, so answer **exempt** to the export question |
| Screenshots | 6.7" (1290 × 2796) and 6.5" (1242 × 2688) — regenerate at those sizes |

---

## What to check after any release

```bash
node tests/test-ks.js          # the whole worker + customer journey
node tests/test-hardening.js   # security, back button, reports, ratings
node tests/test-pages.js       # the legal pages and their links
node tests/test-pwa.js         # manifest, icons, offline, install
```

And bump `CACHE` in `docs/sw.js` whenever `docs/index.html` changes, or
phones that already have the app keep serving the old one.
