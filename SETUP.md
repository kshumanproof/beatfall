# Beatfall — getting it live

Follow these in order. Everything you need to create is free to start except the
domain. Budget about an hour for the first pass.

Anything marked **SERVER ONLY** must never be pasted into a file that ends up in
GitHub. The `.gitignore` here already excludes `.env` files, and none of the keys
live in the code — they go into Vercel's settings.

---

## 1. Put the code in GitHub

```
cd beatfall
git init
git add .
git commit -m "Beatfall"
```

Make a new **private** repo on GitHub called `beatfall`, then follow the two
lines GitHub shows you for pushing an existing repository.

From here on, GitHub is your backup and your history. Commit whenever something
works.

---

## 2. Supabase — accounts and the database

1. Create a project at **supabase.com**. Any region near you; the free tier is
   plenty for a test.
2. Open **SQL Editor**, paste the entire contents of `supabase/schema.sql`, run it.
   It should say success with no rows returned.
3. **Authentication → Providers →** make sure **Email** is on, and turn
   **Confirm email** ON. That is what makes the magic link work.
4. **Authentication → URL Configuration →** set *Site URL* to
   `https://beatfall.app` and add the same as a redirect URL. Add
   `http://localhost:3000` too if you want to run it locally.
5. **Project Settings → API →** copy three values for later:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` **SERVER ONLY**

---

## 3. Anthropic — the writing help

1. **console.anthropic.com → API keys → Create key.** Copy it once; you can't
   see it again. → `ANTHROPIC_API_KEY` **SERVER ONLY**
2. **Billing →** put a card on and set a **monthly spend limit**. Start at
   something like $50. This is your seatbelt: even if everything else fails,
   your exposure is capped at a number you chose.

---

## 4. Stripe — in test mode

Leave the **Test mode** toggle ON for the whole of this section.

1. **Products → Add product**, three times:
   - Writer — $19 / month recurring
   - Working — $29 / month recurring
   - Volume — $39 / month recurring

   Then one more, **one-off**: Top-up — $6 one time.

   Open each price and copy its **price id** (`price_…`) →
   `STRIPE_PRICE_WRITER`, `STRIPE_PRICE_WORKING`, `STRIPE_PRICE_VOLUME`,
   `STRIPE_PRICE_TOPUP`.
2. **Developers → API keys →** copy the **Secret key** (`sk_test_…`) →
   `STRIPE_SECRET_KEY` **SERVER ONLY**
3. **Settings → Billing → Customer portal →** click **Activate**. Allow
   customers to cancel and update payment methods. This is what powers the
   *Manage billing* button, so you never build those screens.
4. The webhook needs your live URL, so **come back to this after step 5.**

---

## 5. Vercel — hosting

1. **vercel.com → Add New → Project → Import** your `beatfall` repo.
2. Framework preset: **Other**. Leave build and output settings empty — this is
   static files plus serverless functions and Vercel handles that by itself.
3. **Settings → Environment Variables →** add every line from `.env.example`
   with your real values. Set them for Production *and* Preview.
   Set `SITE_URL` to `https://beatfall.app`.
4. Deploy. You'll get a `…vercel.app` address. Check it loads and shows the
   sign-in page.
5. **Settings → Domains →** add `beatfall.app` and follow the DNS instructions
   at your registrar. Give it a few minutes.

### Then finish Stripe

**Developers → Webhooks → Add endpoint**

- URL: `https://beatfall.app/api/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`

Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` in Vercel,
then **redeploy** so the new variable is picked up.

---

## 6. Make yourself the admin

Sign in once at `https://beatfall.app` with your own email, so your account
exists. Then in the Supabase SQL editor:

```sql
update public.profiles set is_admin = true where email = 'you@yourdomain.com';
```

`https://beatfall.app/admin.html` will now open for you and nobody else.

---

## 7. Check it before anyone else does

Work through this list. Every one of these has broken in a real product at some
point, which is why they're on it.

- [ ] Sign in with a fresh email address you've never used. Link arrives, click
      it, you land on the board.
- [ ] The welcome screen appears, and only on a genuinely empty account.
- [ ] Paste in a notes file. Details fill in, cards land, gaps stay empty.
- [ ] Reload the page. Everything is still there.
- [ ] Sign in on a phone or another browser. Same projects.
- [ ] Type a note. Confirm the credits counter in the corner drops.
- [ ] Settings shows the right usage and the trial countdown.
- [ ] Subscribe with Stripe's test card `4242 4242 4242 4242`, any future
      expiry, any CVC. Plan updates on the settings page within a few seconds.
- [ ] *Manage billing* opens the Stripe portal. Cancel there, come back, and the
      plan changes.
- [ ] Try card `4000 0000 0000 0341` — it attaches but fails on charge. You
      should end up `past_due`, not broken.
- [ ] Download your data. Open the file. Your projects are in it.
- [ ] `/admin.html` shows you, your usage and your cost. Sign out and confirm a
      second test account can't reach it.
- [ ] Delete a throwaway test account and confirm it's gone from Supabase.

---

## 8. When you go live

1. Stripe: flip off Test mode, recreate the four products, swap the four price
   ids and `STRIPE_SECRET_KEY` in Vercel, and create the webhook again in live
   mode for a new `STRIPE_WEBHOOK_SECRET`. **Test-mode ids do not work in live
   mode** — this is the step everyone forgets.
2. Raise your Anthropic spend limit deliberately, not automatically.
3. Redeploy.

---

## What each piece is

| Where | What it does |
|---|---|
| `public/index.html` | The board. Everything you've been testing. |
| `public/login.html` | Magic-link sign-in. |
| `public/settings.html` | Plan, usage, data export, account deletion. |
| `public/admin.html` | Yours only. Who signed up, what they did, what they cost. |
| `public/app.js` | The layer between the board and the server. |
| `api/claude.js` | The only place your Anthropic key exists. Meters every call. |
| `api/projects.js` | Loads and saves boards. |
| `api/account.js` | Profile, usage, export, delete. |
| `api/billing.js` | Checkout, portal, top-ups. |
| `api/stripe-webhook.js` | The only thing allowed to change someone's plan. |
| `api/admin.js` | Your numbers. |
| `supabase/schema.sql` | The database. Run once. |

## Two things worth understanding

**Your API key is never in the browser.** Every AI call goes to
`/api/claude`, which checks who you are and what you have left before spending
anything. Somebody reading the page source finds nothing worth having.

**Credits are counted, placements are not.** Placing a note costs a fifth of a
cent and it's the core habit — charging for it would make people hesitate before
capturing an idea, which would break the product. Conversations and notes-file
imports are what get metered.

## The numbers to watch, once testers are in

`/admin.html` shows credits and API cost per active user at the median, 75th and
90th percentile. **Set the tier caps from those, not from the guesses currently
in the code.** A cap near the 90th percentile means almost nobody ever discovers
there is one.

To change them: `api/_lib/core.js`, the `PLANS` object.
