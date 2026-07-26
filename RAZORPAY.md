# Setting up payments

Written for the shop owner, not a developer. Nothing here needs any coding.

You will do this **once**. It takes about half an hour, plus a wait of one to three working days while
Razorpay checks your documents.

Everything is registered to **budgetphonestorebongaigaon@gmail.com**. Do not use any other email
address, and do not reuse a login from any other website or business.

---

## What you need before you start

Have these to hand. Razorpay will ask for all of them.

- **PAN card** — yours, or the shop's if it is registered
- **Bank account details** — account number and IFSC code. This is where your money arrives.
- **A cancelled cheque or a bank statement** — a photo is fine
- **Address proof for the shop** — electricity bill, rent agreement or trade licence
- **GST number** — only if you have one. You can complete this without GST.

Use a laptop if you have one. It works on a phone, but uploading documents is fiddly on a small
screen.

---

## Step 1 — Create the Razorpay account

1. Go to **razorpay.com** and click **Sign Up**
2. Enter **budgetphonestorebongaigaon@gmail.com** and choose a password
3. Confirm the email they send you
4. When asked what you are signing up for, choose **Accept Payments**

Write the password down somewhere safe. This account will hold your money.

---

## Step 2 — Fill in your business details

Razorpay asks a series of questions. The answers that matter:

| Question | Answer |
|---|---|
| Business type | **Proprietorship** — unless your shop is registered as a company |
| Business category | **Ecommerce** |
| Sub-category | **Electronics and furniture** |
| Business model | Selling second-hand and refurbished mobile phones |
| Website | Your shop's web address, once it is live |

If you do not have the web address yet, put it in later. Razorpay lets you finish the rest first.

---

## Step 3 — Upload your documents

Follow the on-screen list and upload the PAN, the bank proof and the address proof from the list
above.

**Then wait.** Razorpay reviews these, and it usually takes one to three working days. They email you
when you are approved.

You can carry on with Step 4 while you wait — test keys work immediately.

---

## Step 4 — Get your two keys

1. Sign in to the Razorpay Dashboard
2. Top right, there is a switch marked **Test Mode / Live Mode**
3. Go to **Settings → API Keys**
4. Click **Generate Test Key**

You now see two values:

- **Key Id** — starts with `rzp_test_`
- **Key Secret** — a long string of letters and numbers

**Copy both immediately.** Razorpay shows the secret only once. If you lose it you must generate a new
pair.

> **The Key Secret is like your bank password.** Never put it in a WhatsApp message, never email it,
> never paste it into a website form other than the hosting dashboard below. Anyone holding it can
> take payments in your name.

---

## Step 5 — Put the keys into the website

The website reads the keys from its hosting dashboard. They are never stored in the shop's code.

1. Sign in to **vercel.com** with budgetphonestorebongaigaon@gmail.com
2. Open your project
3. Go to **Settings → Environment Variables**
4. Add the first one:

   | Box | What to put |
   |---|---|
   | Key | `RAZORPAY_KEY_ID` |
   | Value | the `rzp_test_...` value you copied |

5. Click **Save**, then add the second one the same way:

   | Box | What to put |
   |---|---|
   | Key | `RAZORPAY_KEY_SECRET` |
   | Value | the long secret you copied |

6. Make sure both are ticked for **Production**

Spelling matters. `RAZORPAY_KEY_ID` in capitals, with underscores, no spaces.

---

## Step 6 — Redeploy, or nothing takes effect

This step is easy to miss and the keys do nothing without it.

1. Click the **Deployments** tab
2. Find the deployment at the top
3. Click the **⋯** menu on its right
4. Click **Redeploy**

Wait about a minute.

---

## Step 7 — Test it with fake money

Test keys take real-looking payments that cost nothing. Use them before you go live.

1. Open your shop and add any phone to the cart
2. Go through checkout and choose **Cash on delivery**
3. Check the booking charge shows as a tenth of the total
4. Click the pay button — the Razorpay window should open

Pay with this test card:

| Field | Value |
|---|---|
| Card number | `4111 1111 1111 1111` |
| Expiry | any future date, e.g. `12/30` |
| CVV | any three digits |
| Name | anything |
| OTP | `1234` if it asks |

**If the order confirmation page appears, it worked.** 🎉

Check the payment landed: Razorpay Dashboard → **Transactions → Payments**. Your test payment should
be listed there.

> If the confirmation page says *"placed in test mode"*, the keys have not reached the site. Go back
> to Step 5 and check the spelling, then redo Step 6.

---

## Step 8 — Go live

Only do this after Razorpay has emailed to say your account is approved, and after Step 7 worked.

1. In the Razorpay Dashboard, flip the switch to **Live Mode**
2. **Settings → API Keys → Generate Live Key**
3. Copy the new `rzp_live_...` Key Id and its secret
4. Go back to Vercel → **Settings → Environment Variables**
5. Edit `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, replacing them with the live pair
6. Add one more variable, which switches off the test-mode fallback for good:

   | Box | What to put |
   |---|---|
   | Key | `VITE_PAYMENTS_MODE` |
   | Value | `live` |

7. **Redeploy again** (Step 6)

Now make one real payment to yourself — buy the cheapest phone on the site with your own UPI, for
about ₹500. Confirm the money appears in the Razorpay Dashboard, then refund it from there. That
proves the whole chain works before a customer touches it.

---

## When does the money reach your bank?

Razorpay holds each payment briefly, then transfers it to the bank account you registered. The first
settlement usually takes a few working days; after that it settles on a regular cycle you can see
under **Settings → Settlement**.

Their fee is deducted automatically. Check the current rate on your dashboard — it is around 2% plus
GST for cards and net banking, and lower for UPI.

---

## What the booking charge does

When a customer chooses cash on delivery, the shop collects a booking charge of **at least a tenth of
the order total** through Razorpay straight away. The rest is cash to the courier.

That money is yours the moment it is paid. If a customer refuses a delivery that matched its listing,
you keep it — it covers the round trip. If the phone did not match, or you could not deliver, refund
it from the Razorpay Dashboard: find the payment under **Transactions → Payments** and click
**Refund**.

---

## If something goes wrong

| What you see | What it means |
|---|---|
| "placed in test mode" on the confirmation page | The keys have not reached the site. Redo Steps 5 and 6. |
| The Razorpay window never opens | Usually a slow connection. Try again on better signal. |
| "We could not confirm this payment" | The payment did not verify. **Do not ask the customer to pay again.** Check Razorpay → Transactions; if the money is there, it will auto-refund within five working days. |
| Payment succeeds but no money in the bank | Normal for the first few days. Check **Settings → Settlement**. |

Razorpay support is at **razorpay.com/support**, and they answer from the dashboard chat. Have your
Merchant Id ready — it is on the dashboard home page.
