# Tests

Playwright harnesses that drive the real `docs/index.html` in a browser.
There is no build step and no framework — each file is a script that prints
what it found, so a failure reads like a sentence rather than a stack trace.

```bash
npm i playwright        # once
node tests/test-ks.js
```

| File | What it covers |
|---|---|
| `test-ks.js` | The whole journey: register → verify → review → approve → search → book → rate → delete |
| `test-hardening.js` | Back-button navigation, manifest shortcuts, rating limits, reporting, admin PIN |
| `test-pages.js` | About, privacy, terms, cancellations, account deletion — links, styling, overflow |
| `test-pwa.js` | Manifest, icons, offline shell, install prompt |
| `test-landing.js` | Landing page across five viewports, reduced motion |
| `test-paging.js` | Server-side paging with 137 seeded workers |
| `test-upload.js` | Both photo paths — R2 endpoint and Supabase Storage fallback |
| `test-bulk.js` | Bulk approval from a pasted WhatsApp thread |
| `lint-app.js` | Parse errors, `$()` calls with no element, undefined handlers, CSS braces |
| `band-audit.js` | Every price band printed against its pricing unit, to spot mismatches |
| `make-store-assets.js` | Regenerates the Play screenshots and feature graphic into `docs/store/` |

The database schema has its own check: `.github/workflows/setup-kaamsetu-db.yml`
applies `docs/supabase-workers-setup.sql` on every push and then queries the
live database to confirm the result. The file is applied whole each time, so
**every statement in it must be safe to run again** — test with three
consecutive applications before pushing.

## Schema

`schema-verify.sql` checks the security properties of
`docs/supabase-workers-setup.sql` against a local Postgres: the published PINs
are refused, only approved profiles are visible to `anon`, the phone column is
unreadable in bulk, search returns no numbers, ratings are one per device,
changing a photo sends a profile back for review, and deletion cascades.

```bash
createdb nearse_test
psql -d nearse_test -f docs/supabase-workers-setup.sql   # three times, it must be idempotent
psql -d nearse_test -f tests/schema-verify.sql
```

It needs roles named `anon` and `authenticated` to exist, as they do on
Supabase, or the column-grant block has nothing to apply to.
