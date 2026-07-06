# 🚗 Budget Cars Website

A complete, ready-to-launch website for **Budget Cars** — a second-hand car showroom.
The whole site is a single file: [`index.html`](index.html). No build step, no server needed.

Cars are stored in **Supabase** (free), so cars you add appear for **every visitor on every device**.
Until Supabase is connected, the site runs in demo mode (cars save only in your own browser).

## Step 1 — Set up Supabase (one time, ~5 minutes)

1. Go to [supabase.com](https://supabase.com), sign up free, and click **New project**
   (any name, e.g. "budget-cars"; choose a database password and save it somewhere).
2. When the project opens, go to **SQL Editor → New query**.
3. Copy the whole of [`supabase-setup.sql`](supabase-setup.sql), paste it in, and click **Run**.
   *(Want a different owner PIN than `7086`? Change it in the marked line before running.)*
4. Go to **Settings → API** and copy two things:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** key (a long string)
5. Open [`index.html`](index.html), find these two lines near the top of the `<script>` section,
   and paste your values between the quotes:

   ```js
   const SUPABASE_URL      = "";   // e.g. "https://abcdxyz.supabase.co"
   const SUPABASE_ANON_KEY = "";   // Settings → API → anon public key
   ```

That's it. The site now loads cars from Supabase, and owner mode adds/deletes them there.

## Step 2 — Launch on GitHub Pages (free hosting)

1. Merge this branch into `main`.
2. On GitHub go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/docs`, then click **Save**.
5. In a minute your website is live at `https://<your-username>.github.io/salinur/`.

## Features

- **Car listings** with photo, year, km driven, fuel, transmission, owners, insurance, location, price and description
- **Search, fuel filter and price sorting** for customers
- **Book Now** on every car — customer picks a token amount between **₹10,000 and ₹1,00,000** with a slider; the booking is sent to your WhatsApp (70862 69537) with all details
- **Owner mode** (tap 🔐 Owner, enter your PIN) to **add cars** (with photo upload) and **delete cars** — changes go live for everyone instantly
- Contact section with call button, WhatsApp button and Instagram link (@budgetcars.insta)

## Security

Visitors can only *read* the car list. Adding and deleting go through database functions
that verify the owner PIN **on the server** — the PIN is stored in a table no visitor can
read, so nobody can change your inventory without it. (Don't share the PIN; you can change
it any time in Supabase → Table Editor → `owner_settings`.)
