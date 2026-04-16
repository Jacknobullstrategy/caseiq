# CaseIQ — Deployment Guide

Follow these steps in order. Takes about 30 minutes total.

---

## Step 1 — Create a GitHub account (if you don't have one)

1. Go to github.com → Sign up (free)
2. Create a new repository called `caseiq`
3. Upload all the files from this folder into it

---

## Step 2 — Deploy to Netlify

1. Go to **netlify.com** → Sign up with your GitHub account
2. Click **"Add new site" → "Import an existing project"**
3. Connect GitHub and select your `caseiq` repo
4. Build settings are automatic (netlify.toml handles it)
5. Click **Deploy** — your site will be live at a `.netlify.app` URL

---

## Step 3 — Enable Netlify Identity

1. In your Netlify dashboard → go to **Site configuration → Identity**
2. Click **Enable Identity**
3. Under **Registration preferences** → set to **Invite only** (so only people you invite can sign up)
4. Under **External providers** → optionally enable Google login

---

## Step 4 — Get your Anthropic API key

1. Go to **console.anthropic.com** → sign in
2. Click **API Keys → Create Key**
3. Copy the key (starts with `sk-ant-`)

---

## Step 5 — Set up Stripe

1. Go to **dashboard.stripe.com** → create an account
2. Create a product:
   - **Products → Add product**
   - Name: "CaseIQ Solo"
   - Price: $199/month (recurring)
   - Copy the **Price ID** (starts with `price_`)
3. Get your **Secret Key** from **Developers → API Keys** (starts with `sk_live_`)

---

## Step 6 — Add environment variables to Netlify

In Netlify dashboard → **Site configuration → Environment variables → Add variable**:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic key (`sk-ant-...`) |
| `STRIPE_SECRET_KEY` | Your Stripe secret key (`sk_live_...`) |
| `STRIPE_PRICE_ID` | Your Stripe price ID (`price_...`) |
| `STRIPE_WEBHOOK_SECRET` | (get this in Step 7 below) |
| `NETLIFY_IDENTITY_TOKEN` | (get this from Netlify Identity settings) |

---

## Step 7 — Set up Stripe webhook

1. In Stripe dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) → add as `STRIPE_WEBHOOK_SECRET` env var

---

## Step 8 — Get Netlify Identity admin token

1. In Netlify dashboard → **Site configuration → Identity → Settings and usage**
2. Scroll to **Identity API** → copy the **JWT secret**
   (If not visible, look under **Team settings → API access**)
3. Add as `NETLIFY_IDENTITY_TOKEN` env var

---

## Step 9 — Trigger a redeploy

In Netlify → **Deploys → Trigger deploy** so the new env vars take effect.

---

## Step 10 — Set up your custom domain (optional)

1. In Netlify → **Domain management → Add custom domain**
2. Enter something like `caseiq.nobullstrategy.com`
3. Follow the DNS instructions (takes ~10 minutes to propagate)

---

## You're live! Giving access to a lawyer:

1. In Netlify → **Site configuration → Identity → Invite users**
2. Enter their email → they get a signup link
3. They sign up → 14-day free trial starts automatically
4. After 14 days → they see the paywall and subscribe via Stripe
5. Stripe webhook fires → "paid" role granted → full access

---

## Pricing you can change

Edit the price in Stripe and update `STRIPE_PRICE_ID`. You can create multiple plans (Solo, Firm) with different Stripe prices and point users to different checkout links.

---

## Need help?

Email: hello@nobullstrategy.com
