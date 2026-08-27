// ── The Hall Farm Gym — backend ──────────────────────────────
// Real bookings, credits and Stripe payments for the private-hire gym.
// Run with:  npm start   (see README.md)

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");

// ---- business rules (same numbers as the app) ----
const CONFIG = {
  OPEN_HOUR: 6,
  CLOSE_HOUR: 21,
  SESSION_MIN: 40,
  TURNAROUND_MIN: 5,
  PRICE_GBP: 10,          // pay-as-you-go per session
  MEMBERSHIP_PRICE: 40,   // per month
  MEMBERSHIP_CREDITS: 80, // credits included (10x scale: 80 credits/month, 10 per session)
  EXTRA_CREDIT_PRICE: 6,  // per additional credit (now gives 10 credits)
  MAX_PARTY: 4,           // people per session incl. the booker
  GUEST_PRICE: 4,         // per extra person (non-members)
  SESSION_CREDIT_COST: 10, // credits per session for members
  GROUP_BOOKING_CREDIT: 7.5, // credits per person in member group
  DAYS_BOOKABLE: 10,      // how far ahead people can book
};
const SLOT_MIN = CONFIG.SESSION_MIN + CONFIG.TURNAROUND_MIN;
const PENDING_HOLD_MIN = 15; // minutes an unpaid checkout holds a slot

const OWNER_PASSCODE = "gym1234"; // Hardcoded for testing
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PORT = process.env.PORT || 3000;

const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const stripe = STRIPE_KEY ? require("stripe")(STRIPE_KEY) : null;
const PRACTICE_MODE = !stripe;

// ---- helpers ----
function buildSlots() {
  const slots = [];
  let t = CONFIG.OPEN_HOUR * 60;
  const end = CONFIG.CLOSE_HOUR * 60;
  while (t + CONFIG.SESSION_MIN <= end) {
    slots.push(t);
    t += SLOT_MIN;
  }
  return slots;
}
const SLOTS = new Set(buildSlots());

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function liveCredits(member) {
  if (!member) return 0;
  return member.month_key === currentMonthKey() ? member.credits : 0;
}
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(s + "T00:00:00");
  if (isNaN(d)) return false;
  const diffDays = Math.round((d - today) / 86400000);
  return diffDays >= 0 && diffDays < CONFIG.DAYS_BOOKABLE;
}
function validPhone(s) {
  // UK phone validation: strip spaces/dashes, check it's 10-11 digits, starting with 0
  const cleaned = String(s || "").replace(/[\s\-()]/g, "");
  if (!/^\d{10,11}$/.test(cleaned)) return false;
  if (!cleaned.startsWith("0")) return false;
  // Check for valid UK area codes: 020 (London), 01 (geographic), 07 (mobile)
  if (cleaned.startsWith("020") || cleaned.startsWith("01") || cleaned.startsWith("07")) return true;
  return false;
}
function cleanExpiredPendings() {
  const cutoff = Date.now() - PENDING_HOLD_MIN * 60000;
  db.prepare("DELETE FROM bookings WHERE status='pending' AND created_at < ?").run(cutoff);
  db.prepare("DELETE FROM purchases WHERE status='pending' AND created_at < ?").run(cutoff);
}
function addCreditsTo(phone, name, qty) {
  const existing = db.prepare("SELECT * FROM members WHERE phone=?").get(phone);
  const balance = liveCredits(existing) + qty;
  db.prepare(
    `INSERT INTO members (phone, name, credits, month_key) VALUES (?,?,?,?)
     ON CONFLICT(phone) DO UPDATE SET name=excluded.name, credits=excluded.credits, month_key=excluded.month_key`
  ).run(phone, name, balance, currentMonthKey());
  return balance;
}

// Finalize a paid booking / purchase. Idempotent — safe to call twice
// (both the redirect back from Stripe and the webhook call this).
function finalizeBooking(id) {
  const b = db.prepare("SELECT * FROM bookings WHERE id=?").get(id);
  if (!b || b.status === "confirmed") return b;
  if (b.used_credit) {
    const m = db.prepare("SELECT * FROM members WHERE phone=?").get(b.phone);
    const creditCost = b.member_group ? CONFIG.GROUP_BOOKING_CREDIT : CONFIG.SESSION_CREDIT_COST;
    const balance = Math.max(0, liveCredits(m) - creditCost);
    db.prepare("UPDATE members SET credits=?, month_key=? WHERE phone=?").run(
      balance, currentMonthKey(), b.phone
    );
  }
  db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(id);
  return db.prepare("SELECT * FROM bookings WHERE id=?").get(id);
}
function finalizePurchase(id) {
  const p = db.prepare("SELECT * FROM purchases WHERE id=?").get(id);
  if (!p || p.status === "confirmed") return p;
  addCreditsTo(p.phone, p.name, p.qty);
  db.prepare("UPDATE purchases SET status='confirmed' WHERE id=?").run(id);
  return db.prepare("SELECT * FROM purchases WHERE id=?").get(id);
}

const app = express();

// Stripe webhook needs the raw body — register BEFORE express.json().
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!stripe) return res.status(400).send("Stripe not configured");
  let event;
  const whSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  try {
    if (whSecret) {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], whSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const meta = event.data.object.metadata || {};
    if (meta.booking_id) finalizeBooking(Number(meta.booking_id));
    if (meta.purchase_id) finalizePurchase(Number(meta.purchase_id));
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- public API ----

app.get("/api/config", (req, res) => {
  res.json({ ...CONFIG, practiceMode: PRACTICE_MODE });
});

// Availability for one day. Public view: no customer names or phone numbers,
// only whether each slot is taken (owner-blocked slots show their label,
// matching how the app displayed them).
app.get("/api/availability", (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return res.status(400).json({ error: "Invalid date" });
  cleanExpiredPendings();
  const rows = db.prepare("SELECT slot, via, name FROM bookings WHERE date=?").all(date);
  const taken = {};
  for (const r of rows) {
    taken[r.slot] = r.via === "owner" ? { via: "owner", label: r.name } : { via: "booked" };
  }
  res.json({ date, taken });
});

// Has this phone number bought a membership this calendar month?
// Extra credits are a member top-up — without this check, £6 credits
// would undercut the £10 pay-as-you-go rate for non-members.
function isMemberThisMonth(phone) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return !!db
    .prepare(
      "SELECT id FROM purchases WHERE phone=? AND type='membership' AND status='confirmed' AND created_at>=?"
    )
    .get(phone, start.getTime());
}

app.get("/api/is-member/:phone", (req, res) => {
  res.json({ member: isMemberThisMonth(req.params.phone.trim()) });
});

// Credit balance lookup by phone (used at booking time).
app.get("/api/credits/:phone", (req, res) => {
  const m = db.prepare("SELECT * FROM members WHERE phone=?").get(req.params.phone.trim());
  res.json({ credits: liveCredits(m), name: m ? m.name : null });
});

// Check if this is a first-time booker (no confirmed bookings yet).
app.get("/api/is-first-booking/:phone", (req, res) => {
  const existingBooking = db.prepare("SELECT id FROM bookings WHERE phone=? AND status='confirmed'").get(req.params.phone.trim());
  res.json({ isFirstBooking: !existingBooking });
});

// Book a slot. If a credit fully covers it → confirmed instantly.
// Otherwise → returns a Stripe Checkout URL to pay.
app.post("/api/book", async (req, res) => {
  try {
    const { date, slot, name, phone, party, useCredit, guestsAreMembers } = req.body || {};
    const nm = String(name || "").trim().slice(0, 80);
    const ph = String(phone || "").trim().slice(0, 30);
    const pty = Number(party) || 1;
    const sl = Number(slot);

    if (!validDate(date)) return res.status(400).json({ error: "Pick a valid day." });
    if (!SLOTS.has(sl)) return res.status(400).json({ error: "Pick a valid time slot." });
    if (!nm || !ph) return res.status(400).json({ error: "Enter your name and phone number." });
    if (!validPhone(ph)) return res.status(400).json({ error: "Enter a valid UK phone number." });
    if (pty < 1 || pty > CONFIG.MAX_PARTY)
      return res.status(400).json({ error: `Sessions are for 1–${CONFIG.MAX_PARTY} people.` });

    // Check if first-time booker needs to sign waiver
    const existingBooking = db.prepare("SELECT id FROM bookings WHERE phone=? AND status='confirmed'").get(ph);
    if (!existingBooking) {
      const waiver = db.prepare("SELECT agreed_to_terms FROM waivers WHERE phone=?").get(ph);
      if (!waiver || waiver.agreed_to_terms !== 1) {
        return res.status(400).json({ error: "waiver_required", message: "Please sign the waiver to proceed." });
      }
    }

    cleanExpiredPendings();
    const existing = db.prepare("SELECT id FROM bookings WHERE date=? AND slot=?").get(date, sl);
    if (existing) return res.status(409).json({ error: "That slot has just been taken. Pick another." });

    let guestFeePence = (pty - 1) * CONFIG.GUEST_PRICE * 100;
    let usingCredit = false;
    let isFirstBooking = false;
    let isMemberGroupBooking = false;

    // Check if this is their first booking — if so, it's free!
    if (!existingBooking) {
      isFirstBooking = true;
    }

    // If guests are members, use reduced group rate and mark as member group booking
    if (guestsAreMembers && pty > 1) {
      guestFeePence = (pty - 1) * CONFIG.GROUP_GUEST_PRICE * 100;
      isMemberGroupBooking = true;
    }

    if (useCredit) {
      const m = db.prepare("SELECT * FROM members WHERE phone=?").get(ph);
      const creditCost = isMemberGroupBooking ? CONFIG.GROUP_BOOKING_CREDIT : CONFIG.SESSION_CREDIT_COST;
      if (liveCredits(m) < creditCost)
        return res.status(400).json({ error: `Need ${creditCost} credits for this booking. You have ${liveCredits(m)}.` });
      usingCredit = true;
    }

    // First booking is free. Otherwise charge normally.
    let amountPence;
    if (isFirstBooking) {
      amountPence = 0; // Free first session!
    } else {
      amountPence = usingCredit ? guestFeePence : CONFIG.PRICE_GBP * 100 + guestFeePence;
    }

    const info = db
      .prepare(
        `INSERT INTO bookings (date, slot, name, phone, party, via, status, amount_pence, used_credit, created_at, member_group)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(date, sl, nm, ph, pty, usingCredit ? "credit" : "session", "pending",
           amountPence, usingCredit ? 1 : 0, Date.now(), isMemberGroupBooking ? 1 : 0);
    const bookingId = info.lastInsertRowid;

    // Fully covered by a credit — nothing to pay, confirm now.
    if (amountPence === 0) {
      const b = finalizeBooking(bookingId);
      return res.json({ status: "confirmed", booking: publicBooking(b) });
    }

    // Something to pay.
    if (PRACTICE_MODE) {
      const token = crypto.randomBytes(16).toString("hex");
      db.prepare("UPDATE bookings SET stripe_session=? WHERE id=?").run("sim_" + token, bookingId);
      return res.json({ status: "redirect", url: `/api/pay/simulate?kind=booking&id=${bookingId}&token=${token}` });
    }

    const lineItems = [];
    if (!usingCredit) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: { name: `Private gym session — ${date}, ${fmtTime(sl)}` },
          unit_amount: CONFIG.PRICE_GBP * 100,
        },
        quantity: 1,
      });
    }
    if (pty > 1) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: { name: "Extra person" },
          unit_amount: CONFIG.GUEST_PRICE * 100,
        },
        quantity: pty - 1,
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      metadata: { booking_id: String(bookingId) },
      success_url: `${BASE_URL}/api/pay/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    db.prepare("UPDATE bookings SET stripe_session=? WHERE id=?").run(session.id, bookingId);
    res.json({ status: "redirect", url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong setting up payment. Try again." });
  }
});

// Buy a membership (8 credits) or extra credits.
app.post("/api/buy-credits", async (req, res) => {
  try {
    const { name, phone, type, qty } = req.body || {};
    const nm = String(name || "").trim().slice(0, 80);
    const ph = String(phone || "").trim().slice(0, 30);
    if (!nm || !ph) return res.status(400).json({ error: "Enter your name and phone number." });
    if (!validPhone(ph)) return res.status(400).json({ error: "Enter a valid UK phone number." });
    if (type !== "membership" && type !== "extra")
      return res.status(400).json({ error: "Invalid purchase type." });

    let credits, amountPence, label;
    if (type === "membership") {
      credits = CONFIG.MEMBERSHIP_CREDITS;
      amountPence = CONFIG.MEMBERSHIP_PRICE * 100;
      label = `Monthly membership — ${CONFIG.MEMBERSHIP_CREDITS} session credits`;
    } else {
      if (!isMemberThisMonth(ph))
        return res.status(403).json({
          error:
            "Extra credits are a top-up for members. Buy a membership first — £40/month includes 8 sessions.",
        });
      const q = Number(qty);
      if (!Number.isInteger(q) || q < 1 || q > 20)
        return res.status(400).json({ error: "Choose between 1 and 20 credits." });
      credits = q;
      amountPence = q * CONFIG.EXTRA_CREDIT_PRICE * 100;
      label = `${q} extra session credit${q === 1 ? "" : "s"}`;
    }

    const info = db
      .prepare(
        `INSERT INTO purchases (phone, name, type, qty, amount_pence, status, created_at)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(ph, nm, type, credits, amountPence, "pending", Date.now());
    const purchaseId = info.lastInsertRowid;

    if (PRACTICE_MODE) {
      const token = crypto.randomBytes(16).toString("hex");
      db.prepare("UPDATE purchases SET stripe_session=? WHERE id=?").run("sim_" + token, purchaseId);
      return res.json({ status: "redirect", url: `/api/pay/simulate?kind=credits&id=${purchaseId}&token=${token}` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: `The Hall Farm Gym — ${label}` },
            unit_amount: amountPence,
          },
          quantity: 1,
        },
      ],
      metadata: { purchase_id: String(purchaseId) },
      success_url: `${BASE_URL}/api/pay/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    db.prepare("UPDATE purchases SET stripe_session=? WHERE id=?").run(session.id, purchaseId);
    res.json({ status: "redirect", url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong setting up payment. Try again." });
  }
});

// Stripe sends the customer back here after paying.
app.get("/api/pay/return", async (req, res) => {
  try {
    if (!stripe) return res.redirect("/");
    const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id || ""));
    if (session && session.payment_status === "paid") {
      const meta = session.metadata || {};
      if (meta.booking_id) {
        const b = finalizeBooking(Number(meta.booking_id));
        return res.redirect(`/?paid=booking&date=${b.date}&slot=${b.slot}&party=${b.party}`);
      }
      if (meta.purchase_id) {
        const p = finalizePurchase(Number(meta.purchase_id));
        return res.redirect(`/?paid=credits&phone=${encodeURIComponent(p.phone)}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  res.redirect("/?cancelled=1");
});

// Practice-mode "payment" — stands in for Stripe when no key is set.
app.get("/api/pay/simulate", (req, res) => {
  const { kind, id, token } = req.query;
  const table = kind === "booking" ? "bookings" : kind === "credits" ? "purchases" : null;
  if (!table) return res.redirect("/");
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(Number(id));
  if (!row || row.stripe_session !== "sim_" + token) return res.redirect("/");
  if (kind === "booking") {
    const b = finalizeBooking(row.id);
    return res.redirect(`/?paid=booking&date=${b.date}&slot=${b.slot}&party=${b.party}&practice=1`);
  }
  const p = finalizePurchase(row.id);
  res.redirect(`/?paid=credits&phone=${encodeURIComponent(p.phone)}&practice=1`);
});

// ---- owner API (passcode-protected) ----
function requireOwner(req, res) {
  if (String(req.body?.passcode || "") !== OWNER_PASSCODE) {
    res.status(403).json({ error: "Wrong passcode." });
    return false;
  }
  return true;
}

app.post("/api/owner/login", (req, res) => {
  if (!requireOwner(req, res)) return;
  res.json({ ok: true });
});

app.post("/api/owner/block", (req, res) => {
  if (!requireOwner(req, res)) return;
  const { date, slot, label } = req.body;
  const sl = Number(slot);
  if (!validDate(date) || !SLOTS.has(sl))
    return res.status(400).json({ error: "Invalid slot." });
  cleanExpiredPendings();
  const existing = db.prepare("SELECT id FROM bookings WHERE date=? AND slot=?").get(date, sl);
  if (existing) return res.status(409).json({ error: "Slot already taken." });
  db.prepare(
    `INSERT INTO bookings (date, slot, name, phone, party, via, status, amount_pence, used_credit, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(date, sl, String(label || "Personal training").trim().slice(0, 80) || "Personal training",
        "", 1, "owner", "confirmed", 0, 0, Date.now());
  res.json({ ok: true });
});

app.post("/api/owner/release", (req, res) => {
  if (!requireOwner(req, res)) return;
  const { date, slot } = req.body;
  db.prepare("DELETE FROM bookings WHERE date=? AND slot=?").run(String(date), Number(slot));
  res.json({ ok: true });
});

// Full detail for a day — names, phones, how each slot was paid.
app.post("/api/owner/day", (req, res) => {
  if (!requireOwner(req, res)) return;
  const { date } = req.body;
  if (!validDate(date)) return res.status(400).json({ error: "Invalid date" });
  cleanExpiredPendings();
  const rows = db
    .prepare("SELECT slot, name, phone, party, via, status, amount_pence FROM bookings WHERE date=? ORDER BY slot")
    .all(String(date));
  res.json({ date, bookings: rows });
});

// Check if user has signed waiver (needed before booking)
app.get("/api/waiver/status/:phone", (req, res) => {
  const ph = String(req.params.phone || "").trim();
  const waiver = db.prepare("SELECT agreed_to_terms FROM waivers WHERE phone=?").get(ph);
  res.json({ signed: !!waiver && waiver.agreed_to_terms === 1 });
});

// Sign waiver (before first booking)
app.post("/api/waiver/sign", (req, res) => {
  try {
    const { name, phone, agreedToTerms, optedOutInduction } = req.body || {};
    const nm = String(name || "").trim().slice(0, 80);
    const ph = String(phone || "").trim().slice(0, 30);

    if (!nm || !ph) return res.status(400).json({ error: "Enter your name and phone number." });
    if (!validPhone(ph)) return res.status(400).json({ error: "Enter a valid UK phone number." });
    if (!agreedToTerms) return res.status(400).json({ error: "You must agree to all terms to proceed." });

    db.prepare(
      `INSERT INTO waivers (phone, name, agreed_to_terms, opted_out_induction, signed_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(phone) DO UPDATE SET agreed_to_terms=excluded.agreed_to_terms,
                                        opted_out_induction=excluded.opted_out_induction,
                                        signed_at=excluded.signed_at`
    ).run(ph, nm, 1, optedOutInduction ? 1 : 0, Date.now());

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Try again." });
  }
});

// ---- misc ----
function publicBooking(b) {
  return { date: b.date, slot: b.slot, name: b.name, party: b.party, via: b.via };
}
function fmtTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${period}`;
}

app.listen(PORT, () => {
  console.log(`The Hall Farm Gym is running → ${BASE_URL}`);
  console.log(
    PRACTICE_MODE
      ? "PRACTICE MODE — no Stripe key set, payments are simulated. Add STRIPE_SECRET_KEY in .env for real payments."
      : `Stripe connected (${STRIPE_KEY.startsWith("sk_live") ? "LIVE — real money" : "test mode"}).`
  );
});
