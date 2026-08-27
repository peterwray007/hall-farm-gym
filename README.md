# The Hall Farm Gym — booking system

Private-hire gym bookings with real card payments. One person (or their invited group) per slot, 6am–10pm daily, 40-minute sessions with a 5-minute reset between each.

What's in the box: the booking website your customers see, a real database that remembers every booking and credit, Stripe card payments, memberships (£40/mo for 8 credits, no roll-over), extra credits at £6, guest fees at £4 a head, and an owner mode for blocking out slots for your PT work.

## Run it on your Mac

You need Node.js installed once — get it from https://nodejs.org (the LTS version). Then, in Terminal:

```
cd ~/Documents/HallFarmGym
npm install
npm start
```

Open http://localhost:3000 in your browser. That's the whole site, live on your machine.

With no Stripe key set, it runs in **practice mode**: everything works — bookings, credits, owner mode — but payments are simulated so you can test freely. A yellow banner on the page reminds you.

## Turn on real payments (test mode first)

1. Go to https://dashboard.stripe.com/test/apikeys and copy your **Secret key** (starts with `sk_test_`).
2. In the HallFarmGym folder, duplicate the file `.env.example` and rename the copy to `.env`.
3. Paste your key after `STRIPE_SECRET_KEY=` and save.
4. Restart the server (`Ctrl+C`, then `npm start` again).

Now the payment button sends people to a real Stripe checkout page. In test mode, use card number `4242 4242 4242 4242`, any future expiry, any CVC — no real money moves. Payments appear in your Stripe test dashboard.

## Going live — the checklist

1. **Change the owner passcode** in `.env` (`OWNER_PASSCODE=`). The default is 1234 and the whole internet knows it.
2. Swap the Stripe key for your **live** key (starts with `sk_live_`) from https://dashboard.stripe.com/apikeys — you'll need your Stripe account fully activated first.
3. Put the site on the internet. A host like Render or Railway can run this Node app from a folder or a GitHub repo — set the same `.env` values there, and set `BASE_URL` to your public address (e.g. `https://book.hallfarmgym.co.uk`).
4. Optional but recommended once live: in the Stripe dashboard add a webhook pointing to `https://YOUR-ADDRESS/api/stripe/webhook` for the event `checkout.session.completed`, and put the signing secret in `.env` as `STRIPE_WEBHOOK_SECRET=`. This is a belt-and-braces guarantee that a paid booking is never missed even if the customer closes their browser at the wrong moment.

## How it protects you

Prices, credit balances and availability are all enforced by the server — nobody can pay the wrong amount or take a taken slot by fiddling with the page. A slot is held for 15 minutes while someone pays; if they abandon checkout, it frees itself. Credits expire at the end of the calendar month, counted properly on the server. Double bookings are impossible at the database level.

## Day-to-day

Owner mode (the small "Owner login" link) lets you block any slot for PT or personal use, see who booked each slot (name, phone, how they paid), and release slots. All data lives in one file, `gym.db`, in this folder — copy that file and you've backed up the whole business.

## Changing things

All prices and rules live near the top of `server.js` in the `CONFIG` block (also mirrored in `public/app.jsx` defaults). The customer page source is `public/app.jsx`; after editing it, run `npm run build` to regenerate `public/app.js`, which is what the site actually serves.
