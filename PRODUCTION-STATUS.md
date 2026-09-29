# Hall Farm Gym production status

## Live architecture
Next.js on Vercel, Supabase Auth/Postgres/RLS, Stripe Checkout/Billing.

## Booking rules
- 07:00–21:00 Europe/London
- 50 minute whole-gym private hire
- 2 minute turnover
- max 5 people
- member bookings consume one shared whole-gym entitlement
- PAYG £12.50 must be paid before a booking becomes confirmed
- database exclusion constraint prevents overlapping confirmed bookings
- admin can block PT/maintenance time

## Memberships
- Solo £45/month: 10 bookings, one named member, one monthly guest allowance
- Duo £70/month: 10 shared bookings, two named members
- Trio £90/month: 10 shared bookings, three named members

## Payment safety
Stripe products/prices exist in the live WrayFitness Stripe account. Customer charging remains disabled in the web UI until server-side secrets and the webhook endpoint are installed. Never expose STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY in client code or GitHub.

Database includes stripe_events for webhook idempotency and checkout_holds for temporary PAYG slot holds.

## Before public launch
1. Vercel project connection must be authorised for the deployment integration.
2. Install server-only Stripe/Supabase secrets in Vercel.
3. Create Stripe webhook and connect membership + PAYG fulfillment.
4. Configure Supabase production auth redirect URL.
5. Create owner account and assign admin role.
6. Add final insurer/solicitor-reviewed T&Cs, waiver, privacy/CCTV and cancellation wording.
7. End-to-end test membership purchase, renewal, failed payment, PAYG, booking, cancellation and admin blocks.
