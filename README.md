# The Hall Farm Gym — Production V2

Private-hire booking platform. Open 07:00–21:00; one booking reserves the whole gym for 50 minutes with a 2-minute turnover; max 5 people. PAYG £12.50. Solo £45/10 bookings, Duo £70/10 shared bookings, Trio £90/10 shared bookings. PostgreSQL prevents overlapping confirmed bookings.

Architecture: Next.js + Supabase Auth/Postgres/RLS + Stripe Checkout/Billing/Webhooks. Never commit Stripe secret keys, Supabase service-role keys, webhook secrets or customer data. Legal/PAR-Q/waiver/privacy/CCTV wording requires insurer/solicitor review before launch.


Deployment trigger: production hosting connected 2026-09-29.
