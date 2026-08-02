# MySheher

A marketplace for booking local skilled workers in Guwahati — maids, cooks,
electricians, plumbers, tutors, drivers, doctors and 160 other trades. Workers
set their own price and MySheher takes no commission.

Live at **[mysheher.com](https://mysheher.com)**.

## What is in here

| Path | What it is |
|---|---|
| `docs/index.html` | The whole MySheher app. One file, no build step. |
| `docs/supabase-workers-setup.sql` | The database. Applied whole on every deploy, so every statement has to be safe to run again. |
| `docs/about/`, `privacy/`, `terms/`, `cancellation/`, `delete-account/` | The legal pages. Plain HTML, no JavaScript, stable URLs. |
| `docs/functions/upload.js` | Cloudflare Pages Function that stores profile photos in R2. |
| `tests/` | Playwright harnesses and SQL checks. See [`tests/README.md`](tests/README.md). |
| `store/` | Play Store and App Store submission package. See [`store/README.md`](store/README.md). |
| `brand/` | Advertising copy and prompts. |
| `DEPLOY.md` | Setup steps in plain language. **Start with Job 0.** |

## How it is built

No framework and no build step — the app is a single HTML file served by
GitHub Pages from `docs/`, talking to Supabase over its REST API. That is a
deliberate choice: it stays free at launch volumes, there is nothing to
break between writing a change and shipping it, and the whole thing can be
read top to bottom.

Data lives in Postgres behind row level security, and anything that changes
data goes through a `SECURITY DEFINER` function that checks a bcrypt-hashed
PIN on the server. Nothing sensitive is readable by the public: approved
profiles are, WhatsApp numbers are handed out one booking at a time, and
everything else is closed.

## Working on it

```bash
npm i playwright        # once
node tests/test-ks.js   # the whole worker and customer journey
```

Two things to remember when changing the app:

1. **Bump `CACHE` in `docs/sw.js`** whenever `docs/index.html` changes, or
   phones that already installed MySheher keep serving the old version.
2. **The SQL file is re-applied on every push.** Test it by applying it three
   times in a row before you push.

## Security

No password, PIN or key belongs in this repository. If you find one, treat it
as compromised, rotate it, and check `DEPLOY.md` — this has happened before.
