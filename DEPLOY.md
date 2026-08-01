# Repto — setup steps, in plain language

**Do Job 0 first. It takes two minutes and it is the only genuinely urgent
thing in this file.** Then Job A (about 20 minutes, before launch) and Job B
(the domain, on a quiet day).

---

# Job 0 — change the admin PIN. Today.

The admin PIN was stored in this repository, which is public. Anyone who
reads the source can work it out. Until you change it, somebody else could
approve worker profiles, take every live worker down, or read the WhatsApp
verification codes.

It is now **refused by the database**, so nobody can use it — including you.
Admin mode stays locked until you do this.

1. Open <https://supabase.com>, sign in, open your project.
2. Click **SQL Editor** in the left sidebar, then **New query**.
3. Paste this in, replacing the words in quotes with a PIN only you know:

```sql
update nearse_admin
   set pin_hash = crypt('pick-a-strong-admin-pin', gen_salt('bf', 12))
 where id = 1;
```

4. Click **Run**. It should say `Success. No rows returned`.
5. Test it: open <https://nearse.in/#admin> and enter the new admin PIN.

Rules for choosing it: not `1234`, not your phone number, and **never typed
into a chat, an email, or a file in this repository**. The database only ever stores a bcrypt hash of a PIN, never the
PIN itself, which is why nobody — including me — can read it back or recover
it for you. Write it down somewhere physical.

The old PIN cannot be un-published: it is in this repository's history for
good. Changing it is the only fix.

---

# Job 0.5 — switch on notifications outside the app

Right now a worker only finds out about a booking by opening Repto and
looking. Everything needed to fix that is built and deployed — the app asks
for permission, the database queues the alert — but nothing sends it until
you do the four steps below. **Until then no notification will ever arrive**,
in either direction, no matter what anybody taps.

> **Do it from the app, not from here.** Open <https://nearse.in/#admin>,
> enter your admin PIN, and go to the **Alerts** tab. It shows which of the
> four steps is missing, reads the live state out of the database, generates
> the key pair for you in your own browser, and saves the public half without
> you touching the SQL editor. The steps below are the same thing written
> out, for when you would rather see them on a page.

About 15 minutes, once, and **no laptop is needed** — every step can be done
in a browser.

## Step 1 — make the key pair

**Easiest:** the **Alerts** tab of the admin screen has a *Generate a key
pair* button. The keys are made by your own browser and neither half is sent
anywhere — that is the whole point of a signing key.

If you would rather use a computer with Node:

```bash
npx web-push generate-vapid-keys
```

Either way you end up with a **Public Key** (about 87 characters) and a
**Private Key** (about 43). Keep them in front of you.

> The private key is a password. Do not screenshot it, do not send it to me,
> do not put it in the repository. It goes into Supabase in Step 3 and
> nowhere else.

> The private key is a password. Do not put it in the repository, do not
> send it to me, do not paste it into a chat. It only ever goes into
> Supabase in Step 3.

## Step 2 — tell the app the public half

**Easiest:** paste it into the box on the **Alerts** tab and press *Save
public key*. It is already filled in if you generated the pair there.

Or, Supabase → **SQL Editor** → **New query**, paste, replace, **Run**:

```sql
update nearse_config set vapid_public = 'PASTE_THE_PUBLIC_KEY_HERE' where id = 1;
```

**Nothing works before this step.** With no key the app cannot even ask a
worker for permission, so nobody is ever subscribed and the queue stays
empty. If you have tested and had no notification, this is almost certainly
why.

The public key is not a secret — the browser needs it to subscribe. That is
why it lives in the database and not in a file: you never touch the code.

## Step 3 — deploy the sender

**In the browser, no command line:**

1. Supabase → **Edge Functions** → **Deploy a new function**
2. Name it exactly **`push`**
3. Paste in the contents of `supabase/functions/push/index.ts` from this
   repository
4. Turn **Verify JWT off** for it — the webhook calls it with nobody logged
   in. That is safe: the function reads nothing from the request, it only
   ever drains the queue.
5. **Edge Functions → Secrets**, add three:

| Name | Value |
|---|---|
| `VAPID_PUBLIC` | the public key |
| `VAPID_PRIVATE` | the private key |
| `VAPID_SUBJECT` | `mailto:hello.repto@gmail.com` |

If you do have a computer with Node, the same thing from the project folder:

```bash
npm i -g supabase
supabase login
supabase link --project-ref mpufunsitqtdkqlibxof
supabase secrets set VAPID_PUBLIC='the public key' \
                     VAPID_PRIVATE='the private key' \
                     VAPID_SUBJECT='mailto:hello.repto@gmail.com'
supabase functions deploy push --no-verify-jwt
```

## Step 4 — make it fire

Supabase → **Database** → **Webhooks** → **Create a new hook**:

| Field | Value |
|---|---|
| Name | `send-push` |
| Table | `push_outbox` |
| Events | **Insert** only |
| Type | **Supabase Edge Functions** |
| Function | `push` |

Then add a safety net so a failed send is retried instead of forgotten.
Supabase → **Integrations** → **Cron** → **Create job**: every minute,
calling the same `push` function.

## Checking it works

1. On your phone, open Repto, sign in as a worker, go to your profile.
2. Under **Booking alerts**, tap **Turn on alerts** and allow the prompt.
3. **Close Repto completely** — swipe it away, do not just go to the home
   screen.
4. From another phone, book that worker.
5. The notification should arrive within a few seconds.

The **Alerts** tab tells you where it stopped without you reading any tables:
whether a key is set, how many workers and customers are subscribed, how many
alerts are waiting, how many gave up, and the last error the push service
returned.

If you would rather look yourself, Supabase → **Table Editor** → `push_outbox`:

- **No row at all** — the worker never subscribed. Go back to step 2 above.
- **A row with `sent_at` empty and `last_error` filled** — the sender ran and
  the push service refused it. The error text says why; a wrong VAPID key is
  the usual answer.
- **A row with `sent_at` empty and `attempts` still 0** — the webhook is not
  firing. Re-check Step 4.
- **`sent_at` filled but no notification on the phone** — the phone is
  blocking it. Android: Settings → Apps → Repto → Notifications.

## What workers will see

| | |
|---|---|
| A new booking request | "New booking request — Amit needs Carpenter in Beltola" |
| A customer replies | "Amit replied — Are you free tomorrow?" |
| You approve their profile | "Your profile is live" |
| You reject it | "Your profile needs a change" plus your reason |

A worker is never notified about their own messages, and a second message in
the same conversation replaces the first notification rather than stacking up.

## What customers will see

The same sender handles both directions, so these need no extra setup — they
start working the moment Step 4 is done.

| | |
|---|---|
| The worker accepts | "Bhaskar accepted your booking — Carpenter is confirmed. Arriving in about 30 minutes." |
| The worker declines | "Bhaskar could not take this one" plus their reason |
| The worker starts | "Bhaskar has started — Carpenter is under way." |
| The job is finished | "Work finished — How did Bhaskar do?" |
| The worker replies | "Bhaskar replied — On my way at 10." |

A customer has no account, so the subscription is tied to the booking itself.
They are asked once, on the **My bookings** screen; after they allow it, every
later booking from that phone is registered automatically. Nobody is asked
before they have made a booking — a permission prompt on a first visit is the
fastest way to get refused for ever.

## Two things worth knowing

**iPhone.** Apple only delivers these to a PWA that has been **added to the
home screen**, on iOS 16.4 or newer. From Safari it will never work, no
matter what anyone allows. The app says so on the profile when it detects an
iPhone that has not been installed.

**Android app.** The Play build needs the notifications permission compiled
in. `store/twa-manifest.json` already sets `enableNotifications: true`, so
this is handled — but if you built the bundle before today, rebuild it.

---

**Use a laptop or desktop if you have one.** It all works on a phone, but the
form in Step 4 has several boxes and is fiddly on a small screen.

Everything else is already built and running. These are the only two things
that need you.

---

## Before you start: what these things are

- **Cloudflare** — a free company that will host your website and store your
  photos. You do not have a Cloudflare account yet.
- **R2** — Cloudflare's photo storage. Free for the first 10 GB, and it never
  charges for people *viewing* the photos. That is why we are using it.
- **Pages** — Cloudflare's website hosting. Free, no traffic limit.

Right now your site is on GitHub Pages and your photos go to Supabase. Both
work. We are moving so the launch stays free and does not break GitHub's rules
about running a business on their free hosting.

## Important: R2 needs a card, the website hosting does not

Job A has two halves, and they are independent:

- **The website hosting (Pages) is free and asks for nothing.** No card, no
  billing details. This is the part that matters most — it removes the problem
  with GitHub's rules about running a business on their free hosting, and it
  has no traffic limit.
- **The photo storage (R2) requires a card on file.** There is no way to skip
  it. You would not be charged within the free allowance, but Cloudflare does
  not offer a hard spending cap, and the authorisation you tick is open-ended.
  That is a fair reason to wait.

**If you do not want to add a card:** skip Steps 2, 3, 5 and 6. Do Steps 1, 4,
7 and 8 only. Photos keep going to Supabase exactly as they do today — the app
falls back on its own and nothing breaks.

The only thing you give up is headroom: Supabase's free photo storage is 1 GB,
which is about 35 days at a thousand registrations a day, and considerably
longer at realistic early numbers. There is no rush.

---

# JOB A — Cloudflare (about 20 minutes)

## Step 1 — Make a free account

1. Go to **dash.cloudflare.com/sign-up**
2. Enter your email and a password
3. Confirm the email they send you

Done. You are in the Cloudflare dashboard.

## Step 2 — Create the photo storage  *(skip if you are not adding a card)*

1. Open the left-hand menu (the ☰ icon on a phone)
2. Under the **Build** heading, tap **Storage & databases**
3. Tap **R2 Object Storage**
4. Click the blue **Create bucket** button

> Cloudflare groups things under headings now. R2 is not on the top level —
> it is inside **Storage & databases**.
5. In *Bucket name*, type exactly:

   ```
   nearse-photos
   ```

6. Under *Location*, choose **Asia-Pacific (APAC)** — it is nearest to Guwahati
7. Click **Create bucket**

(This is where Cloudflare asks for a card, if it hasn't already.)

## Step 3 — Make the photos viewable  *(skip if you skipped Step 2)*

Photos have to be public, or customers cannot see faces.

1. You should now be inside the `nearse-photos` bucket. Click the **Settings**
   tab at the top
2. Scroll to **Public access**
3. Find **R2.dev subdomain** and click **Allow Access**
4. Type `allow` when it asks you to confirm
5. A web address appears, looking something like:

   ```
   https://pub-a1b2c3d4e5.r2.dev
   ```

6. **Copy that address and keep it somewhere.** You need it in Step 6.

## Step 4 — Connect your website

1. Open the left-hand menu again
2. Under the **Build** heading, tap **Compute**
3. Tap **Workers & Pages**
4. Click **Create**

> Same as before: **Workers & Pages** is inside **Compute**, not on the top
> level.
5. Choose the **Pages** tab
6. Click **Connect to Git**
7. Click **Connect GitHub** and sign in to GitHub when asked
8. Allow Cloudflare to see your repositories
9. In the list, choose **salinuralom7-ux / salinur**
10. Click **Begin setup**

Now a settings page appears. Fill it in exactly like this:

| Box | What to put |
|---|---|
| Project name | `nearse` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | **leave completely empty** |
| Build output directory | `docs` |

11. Click **Save and Deploy**

Wait about a minute. It will give you a web address like
`https://nearse.pages.dev`. Open it — your site should be there.

## Step 5 — Connect the storage to the website  *(skip if you skipped Step 2)*

The website needs permission to put photos into the bucket.

1. In your `nearse` Pages project, click **Settings**
2. Click **Functions** in the side menu
3. Scroll to **R2 bucket bindings**
4. Click **Add binding**
5. Fill in:

   | Box | What to put |
   |---|---|
   | Variable name | `PHOTOS` |
   | R2 bucket | `nearse-photos` |

6. Click **Save**

> The variable name must be exactly `PHOTOS` — capital letters, no spaces.
> This is the one thing that must be typed perfectly.

## Step 6 — Tell it where the photos live  *(skip if you skipped Step 2)*

1. Still in **Settings**, click **Environment variables**
2. Under *Production*, click **Add variable**
3. Fill in:

   | Box | What to put |
   |---|---|
   | Variable name | `PHOTO_BASE` |
   | Value | the address you copied in Step 3 |

   For example: `https://pub-a1b2c3d4e5.r2.dev`
   (no slash at the end)

4. Click **Save**

## Step 7 — Redeploy, or none of it takes effect

This step is easy to miss and nothing works without it.

1. Click the **Deployments** tab
2. Find the deployment at the top
3. Click the **⋯** menu on its right
4. Click **Retry deployment**

Wait a minute for it to finish.

## Step 8 — Check it actually worked

1. Open your `https://nearse.pages.dev` address
2. Tap **Register as a worker** → **Create account**
3. Register a test worker: any name, your own WhatsApp number, a 4-digit PIN
4. Go through the steps and add a photo
5. Publish the profile

Now check where the photo went:

6. Go back to Cloudflare → **R2 Object Storage** → **nearse-photos**
7. You should see a folder called `p` with your photo inside it

**If the photo is there — Job A is done.** 🎉

**If you skipped R2:** there is no bucket to check. Instead, just confirm the
test worker's photo shows up on their profile. It will have gone to Supabase,
which is correct and expected.

**If the bucket is empty**, the photo went to Supabase instead. That means
Step 5, 6 or 7 didn't take. Go back and check the variable is spelled
`PHOTOS` exactly, then retry the deployment. Nothing is broken either way —
the app falls back on purpose rather than losing the photo.

8. Delete the test worker: open the profile, scroll down, **Delete my profile**

---

# JOB B — Move the domain (a quiet day, not launch day)

Right now `nearse.in` points at GitHub. This points it at Cloudflare instead.
It takes a few hours to spread across the internet, which is why it should not
be done on the morning of your launch.

**Do this only after Job A is working.**

## Step 1 — Add your domain to Cloudflare

1. Cloudflare dashboard → click **Add a site** (top of the page)
2. Type `nearse.in`
3. Choose the **Free** plan
4. Cloudflare scans your existing settings — click **Continue**

## Step 2 — Change the nameservers at Hostinger

Cloudflare will now show you **two nameserver addresses**, something like:

```
gina.ns.cloudflare.com
rick.ns.cloudflare.com
```

1. Copy both
2. Open **Hostinger** in another tab and sign in
3. Go to **Domains** → `nearse.in` → **DNS / Nameservers**
4. Choose **Change nameservers** → **Use custom nameservers**
5. Delete what is there, paste Cloudflare's two addresses
6. Save

## Step 3 — Point the domain at your site

1. Back in Cloudflare, open your **nearse** Pages project
2. Click **Custom domains**
3. Click **Set up a custom domain**
4. Type `nearse.in` → **Continue** → **Activate domain**
5. Repeat for `www.nearse.in`

## Step 4 — Wait, then check

Give it a few hours. Then open `nearse.in` on your phone using mobile data
(not wifi). If your site loads with a padlock in the address bar, it is done.

**Leave GitHub Pages switched on until you have confirmed this.** Having both
running for a day costs nothing and means you can never end up with no site.

---

# What this costs you

Nothing.

| | Free allowance | What you will use in month one |
|---|---|---|
| Website hosting | unlimited | about 1 GB |
| Photo storage | 10 GB | about 0.9 GB |
| People viewing photos | **always free** | about 17 GB |
| Photo uploads | 1,000,000/month | about 30,000 |
| Database | 500 MB | about 40 MB |
| Database traffic | 5 GB/month | about 2 GB |

Your first real limit is 10 GB of photo storage — roughly **345,000 photos**,
about a year at a thousand registrations a day. After that it costs about one
and a half US cents per extra gigabyte per month.
