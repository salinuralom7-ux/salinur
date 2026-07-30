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
| `test-modes.js` | The four booking modes: instant dispatch with auto-divert, appointment slots, punctuality, registration numbers |
| `dispatch-verify.sql` | The same, against a real Postgres — offer rotation, double-accept, slot collisions, table privileges |
| `test-hardening.js` | Back-button navigation, manifest shortcuts, rating limits, reporting, admin PIN |
| `test-safearea.js` | Nothing hides under the iPhone status bar or home indicator |
| `test-bubbles.js` | Chat bubbles: the read receipt, the WhatsApp meta row, day dividers, no zoom |
| `test-lifecycle.js` | The core loop from both sides: book → accept → work → finish → confirm → review |
| `test-auth-punct.js` | Worker calls travel on a session token, and the punctuality question |
| `test-browse.js` | The browse screen: one category control, removable filters |
| `sweep.js` | Screenshots every screen and reports words / controls / height per screen |
| `test-menu.js` | The side menu, the combined chat list, and the one-button photo step |
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

Two things the file checks about itself, at the end, and both exist because
they were violated:

* **No function may have two overloads.** PostgREST resolves an RPC by name,
  so a second overload makes every call to that name fail with "is not
  unique" — and a test that calls with explicit argument types never notices.
* **`lock_public_functions()` must be the last statement.** Supabase grants
  EXECUTE on every new function to PUBLIC and to anon, so anything defined
  after that call stays reachable by any visitor holding the public key.

One rule for the app, which no browser on a desktop will catch: **anything
pinned to a screen edge must inset itself with `env(safe-area-inset-*)`.** An
installed iOS app draws the status bar and the home indicator *over* the page,
and a desktop browser reports every inset as 0 — so a header that hides under
the clock looks perfect in every test. `test-safearea.js` forces real iPhone
values and measures the edges against them.

And one rule the schema cannot check for you: **a function that verifies a PIN
must not RAISE when the PIN is wrong.** PostgREST wraps an RPC in one
transaction, so the raise rolls back the row `auth_note` just wrote, the
attempt is never counted, and the lockout never fires. Return no rows or null
instead; the client already reads that as "wrong number or PIN".

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

## Scale and abuse

`schema-scale.sql` seeds a throwaway Postgres to the size Guwahati is
expected to reach and then attacks it. Run it after `schema-test.sh`.

The numbers it exists to protect, measured on 5,000 workers / 1,200
bookings / 9,600 messages:

| | before | after |
|---|---|---|
| Browse, first page | 19.4 ms | 7.3 ms |
| Free-text search | 30.8 ms | 9.4 ms |
| Worker polls the chat (every 4 s) | 6.2 ms | 0.2 ms |
| Worker opens My work | 4.5 ms | 0.1 ms |
| Admin review queue | 230 ms | 0.5 ms |
| Admin dashboard | 240 ms | 7.8 ms |
| Guessing a worker's 4-digit PIN | ~40 seconds | ~17 days |

Two of those deserve explaining, because both were invisible until measured:

* The worker calls each re-ran bcrypt, and the chat polls every four
  seconds. That capped how strong the password hash could ever be. A
  session token moved the hash to sign-in only, which is what made cost 10
  affordable.
* The admin queue's 230 ms was 227 ms of bcrypt and 2.4 ms of query. The
  index was already doing its job; the PIN was the cost.

And one that only a test could have caught: the first version of the
lockout counted failed sign-ins into a table and then raised. PostgREST
runs each call in one transaction, so the raise rolled back the very row
that recorded the failure — the counter never moved and the lockout did
nothing at all. Authentication failures now return an empty result instead
of raising. `schema-scale.sql` asserts the count actually stops.
