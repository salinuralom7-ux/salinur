# 🚗 Budget Cars Website

A complete, ready-to-launch website for **Budget Cars** — a second-hand car showroom.
The whole site is a single file: [`index.html`](index.html). No build step, no server, no dependencies.

## How to launch (GitHub Pages — free hosting)

1. Merge this branch into `main`.
2. On GitHub go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/docs`, then click **Save**.
5. In a minute your website will be live at `https://<your-username>.github.io/salinur/`.

You can also open `index.html` directly in any browser — it works offline too.

## Features

- **Car listings** with photo, year, km driven, fuel, transmission, owners, insurance, location, price and description
- **Search, fuel filter and price sorting** for customers
- **Book Now** on every car — customer picks a token amount between **₹10,000 and ₹1,00,000** with a slider, and the booking is sent to your WhatsApp (70862 69537) with all details
- **Owner mode** (tap 🔐 Owner, PIN: `7086`) to **add cars** (with photo upload) and **delete cars**
- Contact section with call button, WhatsApp button and Instagram link (@budgetcars.insta)

## Changing things

Open `index.html` and edit the constants near the top of the `<script>` section:

- `OWNER_PIN` — the PIN for owner mode (currently `7086`)
- `PHONE` — WhatsApp number bookings are sent to

## Important note about added cars

Cars you add are saved in the **browser's local storage** — they appear only on the
device/browser where you added them. The 6 sample cars are built into the site and show
everywhere (you can delete them per-device in owner mode). To make your own cars appear
for every visitor permanently, add them to the `SEED` list inside `index.html`, or ask
for an upgrade to a version with a shared database.
