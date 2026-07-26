# Nearse — setup steps, in plain language

Two jobs. Job A takes about 20 minutes and should be done before you launch.
Job B is the domain, and should be done on a quiet day.

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
2. Tap **I am a worker** → **Create account**
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
