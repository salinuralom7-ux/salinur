# Moving Nearse to Cloudflare — free, and it removes two risks

Two things to do before the launch. Neither costs money.

1. **Host on Cloudflare Pages** instead of GitHub Pages. GitHub's terms say
   Pages "is not intended for or allowed to be used as a free web-hosting
   service to run your online business" — arguable for Nearse, but not
   something to discover mid-campaign. Cloudflare allows commercial use and
   has no bandwidth limit.
2. **Store photos in R2.** R2 never charges for egress. Photo downloads are
   the largest cost at launch volume (~17 GB/month at 1,000 registrations a
   day), and moving them off Supabase is what keeps the free tier viable.

The app already supports both. It posts photos to `/upload` and falls back to
Supabase Storage automatically if that endpoint is not there, so nothing
breaks at any point during the move.

---

## 1. R2 bucket

Cloudflare dashboard → **R2** → *Create bucket*

- Name: `nearse-photos`
- Location: **Asia-Pacific** (closest to Guwahati)

Then open the bucket → **Settings** → *Public access*:

- Either connect a custom domain — `img.nearse.in` is tidy, and needs a CNAME
  in your DNS pointing at the bucket
- Or enable the `r2.dev` development URL to start with

Copy whichever public URL you end up with; it goes in `PHOTO_BASE` below.

## 2. Cloudflare Pages

Cloudflare dashboard → **Workers & Pages** → *Create* → **Pages** →
*Connect to Git* → pick `salinuralom7-ux/salinur`.

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | *(leave empty)* |
| Build output directory | `docs` |

The site is static, so there is nothing to build.

### Bind the bucket

Pages project → **Settings** → *Functions* → **R2 bucket bindings**:

| Variable name | Bucket |
|---|---|
| `PHOTOS` | `nearse-photos` |

The variable **must** be called `PHOTOS` — `functions/upload.js` looks for
exactly that name.

### Environment variable

Pages project → **Settings** → *Environment variables* → Production:

| Name | Value |
|---|---|
| `PHOTO_BASE` | your bucket's public URL, e.g. `https://img.nearse.in` |

No trailing slash.

## 3. Point the domain over

Only after the Pages deployment works on its `*.pages.dev` address.

Pages project → **Custom domains** → *Set up a custom domain* → `nearse.in`,
and add `www.nearse.in` too.

Cloudflare will ask you to move the domain's nameservers from Hostinger to
Cloudflare. That is the part that takes a few hours to propagate, so do it on
a quiet day, not the morning of the launch.

Keep GitHub Pages running until the new site is confirmed live. Nothing is
lost by having both up for a day.

## 4. Check it worked

- Open the site on the `*.pages.dev` address and register a test worker with
  a photo.
- The photo URL on that profile should start with your `PHOTO_BASE`, not with
  `supabase.co`. If it still says supabase.co, the binding is missing or
  misnamed — the app fell back on purpose rather than failing.
- Delete the test profile afterwards from inside the app.

---

## What this leaves you paying

Nothing.

| | Free allowance | Your month-one load |
|---|---|---|
| Cloudflare Pages | unlimited bandwidth | ~1 GB |
| Cloudflare R2 | 10 GB stored, **egress always free** | ~0.9 GB stored, ~17 GB out |
| R2 writes | 1,000,000/month | ~30,000 |
| Supabase database | 500 MB | ~40 MB |
| Supabase egress | 5 GB/month | ~2 GB (paged search only) |

The binding limit becomes R2 storage at 10 GB — roughly **345,000 photos**,
about a year at 1,000 registrations a day. Past that R2 is $0.015/GB/month,
so the eleventh gigabyte costs about one and a half US cents.
