# Kaderee's Enterprises

An online handbag boutique: a shopper-facing catalogue with a bag, checkout and
payment, plus an admin area where the shop owner manages orders and products.

- **Storefront** — home page, shop with category and price filters, product
  pages, slide-out bag, checkout.
- **Catalogue** — six categories: Tot Bags, Kitenge Map (Big), Kitenge Kichwa
  (Big), Kitenge Map (Medium), Kitenge Kichwa (Medium) and Kitenge Small.
- **Payments** — M-Pesa (manual paybill/till, or automatic STK prompt through
  Safaricom Daraja) and bank transfer. Orders are reserved when placed and the
  admin confirms payment.
- **Admin** (`/admin`) — sign in with a password, see every order and move it
  through awaiting payment → paid → shipped → delivered, add and edit bags,
  change prices and stock, and set your payment numbers.
- **Data** — Cloudflare D1 (SQLite). The catalogue, orders, order lines, admin
  password hash, sessions and settings all live there. The catalogue is seeded
  with eight bags the first time the database is touched.

## Run it

```sh
bun install
bun run dev        # http://localhost:3000
bun run build      # dist/client (assets) + dist/store/index.js (Worker)
bun run typecheck
```

Local state lives in `.wrangler/state`. Delete that folder to start from an
empty database again.

## First sign-in

Open `/admin`. The first time, the store asks you to **create the admin
password** — it is stored as a PBKDF2 hash, never in plain text, and sessions
are HttpOnly cookies that expire after 12 hours. There is no default password,
so do this before you share the link widely.

Once signed in, three tabs:

| Tab | What it does |
| --- | --- |
| Orders | Every order with customer, phone, items and total. Buttons move it to paid / shipped / delivered, or cancel it (stock goes back on the shelf). |
| Products | Add a bag, edit any field, hide it from the shop, or delete it. Stock counts down automatically as orders come in. |
| Payments | Your shop name, contact email and phone, delivery charge per km, pick-up address, M-Pesa paybill/till and account number, and bank account details, shown to shoppers at checkout. |

The contact email and phone also power the **Contact** page (`/contact`), its
WhatsApp button and the contact links in the footer — change them once in
Admin → Payments and every one of those updates.

## Delivery and pick-up

At checkout the shopper picks **Deliver to me** or **Pick up in store**.

- **Delivery** is charged per kilometre from the shop: the shopper enters the
distance and the fee is `km × rate`, worked out again on the server so it cannot
be edited in the browser. The rate defaults to `KSh 100` per km
(`DELIVERY_RATE`, or the *Delivery charge* field in Admin → Payments).
- **Pick-up** is free and skips the address fields. The shop's pick-up address
is shown in Admin → Payments (*Pick-up address*).

## Taking money

### M-Pesa without Daraja keys (works immediately)

Enter your paybill or till in **Admin → Payments** (or set `MPESA_PAYBILL` in
`wrangler.jsonc`). If the paybill needs a fixed account number — usually your
phone number — set it with `MPESA_ACCOUNT_NUMBER` or the *Paybill account
number* field; shoppers are then told to type that, and the order number is
shown alongside it for matching payments to orders. The moment a shopper places an order, a payment prompt opens
with the paybill number, the order number to use as the account, the amount and
the four M-Pesa steps, each with a copy button. The same details stay on the
order page. When the money lands, open the order in **Admin → Orders** and press
*Mark as paid*.

### Automatic M-Pesa prompts (STK push)

Create an app on the [Safaricom Daraja portal](https://developer.safaricom.co.ke)
with the *Lipa na M-Pesa Online* API, then set these as Worker secrets:

```
MPESA_ENV=production            # or sandbox
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...             # paybill or till number
MPESA_PASSKEY=...               # from the Daraja app
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline   # or CustomerBuyGoodsOnline for a till
MPESA_CALLBACK_SECRET=...       # any random string; added to the callback URL
```

With those present, checkout shows *Send request*: the shopper gets the PIN
prompt on their phone, and the Worker receives Safaricom's callback at
`/api/payments/mpesa/callback?k=...` and marks the order paid automatically.
Daraja must be able to reach your public URL, so this only works on a deployed
store, not on localhost.

### Bank transfer

Fill in the bank details in **Admin → Payments** (or `BANK_*` variables). The
order page shows them with the order number as the transfer reference; you
confirm the order in the admin once the money arrives.

## Order emails

Every new order and every confirmed payment can be emailed to you. Two emails
are sent per order:

- **New order** — the moment a shopper checks out, with the customer's name,
  phone, email (set as *reply-to*, so replying goes straight to them), items,
  delivery or pick-up, and the total. It says the money is not confirmed yet.
- **Payment received** — once the payment is confirmed: automatically for
  M-Pesa STK payments, or when you press *Mark as paid* / *Shipped* /
  *Delivered* in Admin → Orders. It goes out once per order, not on every
  status change.

Email is sent with [Resend](https://resend.com). Turn it on once:

1. Create a free Resend account **with the address that should receive the
alerts** (today `eric7ndereva@gmail.com`), then create an API key.
2. In **Admin → Payments → Order emails**, paste the key into *Resend API key*
and press *Save details*. (You can instead set the `RESEND_API_KEY` secret —
Freebuff Sites → Secrets, or `bunx wrangler secret put RESEND_API_KEY`. A
server secret wins over the saved key.)
3. Fill *Order alerts go to* — leave it blank to use your contact email — and
press *Send a test email*. The badge above turns from *are off* to *are on*
when a key is saved.

Optionally fill *Send emails from* (or set the `RESEND_FROM` secret), for example
`Kaderee's Enterprises <orders@yourdomain.co.ke>`. Without a verified domain
Resend only accepts its test sender, `onboarding@resend.dev`, and only delivers
to the address that owns the Resend account — which is all a shop alert needs.
Verify a domain in Resend first if you want a custom sender or want alerts to go
to a different inbox. The saved key is never sent back to the browser: the admin
screen only shows whether one is set.

If the mail provider fails, the order itself still goes through; the problem is
logged and no email is sent.

## Notes and constraints

- Prices are whole Kenya shillings, stored as integers. Delivery is charged per
  kilometre from the rate in Admin → Payments (default KSh 100).
- Product photos: the eight seed bags use illustrations in `public/images`. To
  use a real photo, open a bag in Admin → Products and press **Upload photo** —
  JPG, PNG or WebP from a phone or computer, shrunk in the browser to at most
  1400 px before upload. Files are kept in the shop database (`images` table) and
  served from `/api/images/<id>` with a long cache lifetime, so no image host or
  extra storage is needed; 1 MB per photo is the limit. A photo link can still be
  pasted under *Or paste a photo link*.
- The Daraja path has not been exercised against Safaricom's sandbox in this
  environment (that needs your credentials). The manual path is fully tested.
- Orders can only be read with the secret token issued to the browser that
  placed them, which is what the confirmation page uses. There are no shopper
  accounts by design.

## Deploy with Freebuff Sites

The Worker needs a D1 database bound as `DB`. In Sites, add D1 storage named
`DB` for the environment, then deploy:

```sh
bun run build
```

and deploy the output with `deploy.json` (entry `index.js`, assets
`dist/client`). After the first deploy, open `/admin` on the live URL and
create the admin password.

## Layout

```
src/data/types.ts        shared types, categories, money formatting, shipping rules
src/worker/index.ts      Hono API: products, orders, payments, admin
src/worker/db.ts         schema, seed-on-first-use, row mapping
src/worker/auth.ts       PBKDF2 password hashing, sessions, throttling
src/worker/mpesa.ts      Daraja auth, STK push, callback parsing
src/worker/email.ts      order emails through Resend
src/worker/seed.ts       the eight starter bags
src/app/pages            storefront screens and admin/*
src/app/lib              cart, catalogue cache, shop contact details, API helpers
```
