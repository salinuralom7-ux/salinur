# Supabase setup (about 15 minutes)

Supabase is the database, login system and photo storage. Do these steps once.
You never paste keys into chat or into GitHub, only into `.env.local` on your
computer and into Vercel.

---

## 1. Create the project (2 min)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**
   - Name: `influji` (anything works)
   - Database password: click **Generate**, then save it in your password manager.
   - Region: **South Asia (Mumbai)**, closest to your users, so the site is faster.
3. Wait about 1 minute while it sets up.

## 2. Create the tables (1 min)

1. Left menu → **SQL Editor** → **New query**.
2. Open `creators-app/supabase/migrations/20261005090000_init.sql`, copy **all** of it, paste it in, and click **Run**.
3. You should see **"Success. No rows returned"**. It's safe to run again if you're unsure.
4. Check: left menu → **Table Editor** now lists `creators`, `profiles`, `booking_requests`, `shortlists`, `reports` and `payments`.

> Supabase's **Security Advisor** may flag `public_creators` as a "security definer view".
> That's intentional: it's the one public window onto approved, paid-up creators.

## 3. Connect the app (2 min)

1. Left menu → **Project Settings** → **API Keys** (or **Data API**).
2. Copy the **Project URL** and the **Publishable key** (older projects call it the `anon` key).
3. In `creators-app/`, copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   ```

   The publishable key is designed to be public, so it's safe in the browser.
   The **secret / service_role** key is not: it's only needed later for payments, and it never goes in a `NEXT_PUBLIC_` variable.

## 4. Tell Supabase where the site lives (1 min)

Left menu → **Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:3000` for now. Change it to `https://influji.in` at launch.
- **Redirect URLs**, add:
  - `http://localhost:3000/auth/callback`
  - `https://influji.in/auth/callback` and `https://www.influji.in/auth/callback`
  - `https://*.vercel.app/auth/callback` (Vercel preview links)

## 5. Email login codes (2 min)

We log people in with a 6-digit code instead of a link (links often break inside Instagram's in-app browser).

Left menu → **Authentication** → **Emails** → **Templates**. In **both** "Confirm signup" and "Magic Link", replace the body with:

```html
<h2>Your InfluJi login code</h2>
<p>Enter this code to log in:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
```

Set the subject to `Your InfluJi login code`.

> ⚠️ **Before launch:** Supabase's built-in email only sends a few emails per hour, which is fine for testing but not for real users.
> Set up free custom email: sign up at **resend.com** (3,000 emails/month free), verify `influji.in`, then in
> **Authentication → Emails → SMTP Settings** enter Resend's SMTP details (host `smtp.resend.com`, port `465`,
> user `resend`, password = your Resend API key, sender e.g. `hello@influji.in`).

## 6. Google login (8 min)

1. Go to **console.cloud.google.com** → create a project called `InfluJi`.
2. **APIs & Services → OAuth consent screen** → External → fill in the app name, support email and developer email → Save. Add your domain later.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs:** `https://xxxxxxxx.supabase.co/auth/v1/callback` (your Project URL + `/auth/v1/callback`)
4. Copy the **Client ID** and **Client secret**.
5. Supabase → **Authentication → Sign In / Providers → Google** → enable → paste both → Save.

## 7. Try it

```bash
cd creators-app
npm run dev
```

Open `http://localhost:3000/login`, then log in with email (check spam) or Google. The header should now say **Log out**.
In Supabase → **Authentication → Users** you'll see yourself, and **Table Editor → profiles** has your row.

## 8. Make yourself the admin (1 min)

After logging in once, run this in **SQL Editor** (with your own email):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

## 9. Put the same keys in Vercel

Vercel → your project → **Settings → Environment Variables** → add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → redeploy.

---

### Later: phone OTP

SMS in India needs **TRAI DLT registration** (your business documents, a few days to weeks) with an SMS provider
such as Twilio, MessageBird or Vonage. Once approved:
Supabase → **Authentication → Sign In / Providers → Phone** → enter the provider details, then set
`NEXT_PUBLIC_PHONE_LOGIN=true` in `.env.local` and Vercel. The login page then shows an Email / Phone switch.

### Checking the security rules yourself

`npm run test:db` runs 45 checks against a local copy of the database, for example that creators can't approve themselves,
lapsed profiles disappear, and booking requests are rate-limited. It needs Postgres installed locally.
