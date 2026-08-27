const fs = require('fs');
const content = `const { useState, useEffect, useMemo } = React;

// ---- waiver text ----
const WAIVER_TEXT = {
  title: "HEALTH & SAFETY WAIVER & LIABILITY RELEASE",
  subtitle: "IMPORTANT: Please read carefully before using The Hall Farm Gym",
  sections: [
    {
      title: "1. ASSUMPTION OF RISK & HEALTH DECLARATION",
      points: [
        "I am in good physical health and have no medical condition that would prevent me using gym equipment",
        "I am not pregnant, injured, or taking medication that affects my fitness",
        "I will not use the facility if I feel unwell or unable to exercise safely",
        "I understand exercise carries risk of injury, strain, and in rare cases, serious harm"
      ]
    },
    {
      title: "2. SAFE USE & RESPONSIBILITY",
      points: [
        "I have read and will follow all gym safety guidelines and equipment instructions",
        "I accept full responsibility for my own safety and any injuries sustained while using the facility",
        "I will not use equipment beyond my capability or without proper technique",
        "I acknowledge the gym has taken reasonable precautions but cannot guarantee safety"
      ]
    },
    {
      title: "3. GUEST SUPERVISION & LIABILITY",
      points: [
        "If I bring guests, I am solely responsible for their conduct, safety, and wellbeing",
        "I indemnify The Hall Farm Gym against all claims, injuries, or losses arising from my guests' use",
        "Guests must comply with all gym rules and safety procedures"
      ]
    },
    {
      title: "4. MEDICAL EMERGENCY",
      points: [
        "I authorise staff to contact emergency services on my behalf if needed",
        "I am aware basic first aid equipment is available but professional emergency care may not be immediate"
      ]
    },
    {
      title: "5. LIMITATION OF LIABILITY",
      points: [
        "The Hall Farm Gym, its owners, staff, and agents are not liable for injury, loss, or damage arising from your use of the facility, except where prohibited by law."
      ]
    }
  ]
};

// ---- tiny icons (inline SVG) ----
function svgProps(size) {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  };
}
const LockIcon = ({ size = 16, color }) => (
  <svg {...svgProps(size)} style={{ color }}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const CheckIcon = ({ size = 22, color }) => (
  <svg {...svgProps(size)} style={{ color }}><polyline points="20 6 9 17 4 12" /></svg>
);
const ChevronLeftIcon = ({ size = 18 }) => (
  <svg {...svgProps(size)}><polyline points="15 18 9 12 15 6" /></svg>
);
const ChevronRightIcon = ({ size = 18 }) => (
  <svg {...svgProps(size)}><polyline points="9 18 15 12 9 6" /></svg>
);
const XIcon = ({ size = 18 }) => (
  <svg {...svgProps(size)}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const CardIcon = ({ size = 16, style }) => (
  <svg {...svgProps(size)} style={style}>
    <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

// ---- defaults (overwritten by /api/config on load) ----
const DEFAULT_CONFIG = {
  OPEN_HOUR: 6, CLOSE_HOUR: 22, SESSION_MIN: 40, TURNAROUND_MIN: 5,
  PRICE_GBP: 10, MEMBERSHIP_PRICE: 40, MEMBERSHIP_CREDITS: 8,
  EXTRA_CREDIT_PRICE: 6, MAX_PARTY: 4, GUEST_PRICE: 4, DAYS_BOOKABLE: 10,
  practiceMode: false,
};

function dateKey(d) {
  return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, "0")}-\${String(d.getDate()).padStart(2, "0")}\`;
}
function fmtDay(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return \`\${h12}:\${m.toString().padStart(2, "0")}\${period}\`;
}
function validPhone(s) {
  // UK phone validation: strip spaces/dashes, check it's 10-11 digits, starting with 0
  const cleaned = String(s || "").replace(/[\\s\\-()]/g, "");
  if (!/^\\d{10,11}\$/.test(cleaned)) return false;
  if (!cleaned.startsWith("0")) return false;
  // Check for valid UK area codes: 020 (London), 01 (geographic), 07 (mobile)
  if (cleaned.startsWith("020") || cleaned.startsWith("01") || cleaned.startsWith("07")) return true;
  return false;
}
function buildSlots(cfg) {
  const slots = [];
  let t = cfg.OPEN_HOUR * 60;
  const end = cfg.CLOSE_HOUR * 60;
  const step = cfg.SESSION_MIN + cfg.TURNAROUND_MIN;
  while (t + cfg.SESSION_MIN <= end) {
    slots.push(t);
    t += step;
  }
  return slots;
}
function nextDays(n) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}
async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}
async function post(path, body) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function GymBooking() {
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const SLOTS = useMemo(() => buildSlots(cfg), [cfg]);
  const days = useMemo(() => nextDays(cfg.DAYS_BOOKABLE), [cfg.DAYS_BOOKABLE]);

  const [selectedDay, setSelectedDay] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [taken, setTaken] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [modalSlot, setModalSlot] = useState(null);
  const [step, setStep] = useState("details"); // details | waiver | choice | payment | confirmed
  const [form, setForm] = useState({ name: "", phone: "", party: 1, consent: false });
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [waiverOptOut, setWaiverOptOut] = useState(false);
  const [error, setError] = useState("");
  const [creditBalance, setCreditBalance] = useState(0);
  const [payMethod, setPayMethod] = useState("session"); // session | credit
  const [confirmedInfo, setConfirmedInfo] = useState(null); // {dateLabel, timeLabel, party, viaCredit}

  const [extraQty, setExtraQty] = useState(1);
  const [memberModal, setMemberModal] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: "", phone: "" });
  const [memberStep, setMemberStep] = useState("lookup"); // lookup | payment
  const [memberBuyType, setMemberBuyType] = useState("membership");
  const [memberError, setMemberError] = useState("");
  const [isFirstBooking, setIsFirstBooking] = useState(false);

  const [ownerMode, setOwnerMode] = useState(false);
  const [ownerPass, setOwnerPass] = useState("");
  const [ownerPromptOpen, setOwnerPromptOpen] = useState(false);
  const [ownerInput, setOwnerInput] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [ownerDay, setOwnerDay] = useState({});

  const [banner, setBanner] = useState(null); // {kind:'booking'|'credits'|'cancelled', ...}

  const key = days[selectedDay] ? dateKey(days[selectedDay]) : null;

  // Load config once, and pick up "back from payment" query params.
  useEffect(() => {
    api("/api/config").then(setCfg).catch(() => {});
    const q = new URLSearchParams(window.location.search);
    const paid = q.get("paid");
    if (paid === "booking") {
      const d = new Date((q.get("date") || "") + "T00:00:00");
      setBanner({
        kind: "booking",
        dateLabel: isNaN(d) ? q.get("date") : fmtDay(d),
        timeLabel: fmtTime(Number(q.get("slot") || 0)),
        party: Number(q.get("party") || 1),
      });
    } else if (paid === "credits") {
      const phone = q.get("phone") || "";
      api(\`/api/credits/\${encodeURIComponent(phone)}\`)
        .then((r) => setBanner({ kind: "credits", name: r.name, balance: r.credits }))
        .catch(() => setBanner({ kind: "credits", name: null, balance: null }));
    } else if (q.get("cancelled")) {
      setBanner({ kind: "cancelled" });
    }
    if (paid || q.get("cancelled")) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  async function refresh() {
    if (!key) return;
    try {
      const r = await api(\`/api/availability?date=\${key}\`);
      setTaken(r.taken || {});
      if (ownerMode && ownerPass) {
        const d = await post("/api/owner/day", { passcode: ownerPass, date: key });
        const map = {};
        for (const b of d.bookings) map[b.slot] = b;
        setOwnerDay(map);
      } else {
        setOwnerDay({});
      }
    } catch (e) {
      // leave as-is
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [key, ownerMode]);

  function openSlot(mins) {
    const booking = taken[mins];
    if (ownerMode) {
      setModalSlot(mins);
      setStep(booking ? "ownerRelease" : "ownerReserve");
      setOwnerLabel("");
      return;
    }
    if (booking) return;
    setModalSlot(mins);
    setStep("details");
    setForm({ name: "", phone: "", party: 1, consent: false });
    setPayMethod("session");
    setError("");
  }

  function closeModal() {
    setModalSlot(null);
    setStep("details");
    setError("");
    refresh();
  }

  async function submitDetails(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Enter your name and phone number.");
      return;
    }
    if (!validPhone(form.phone.trim())) {
      setError("Enter a valid UK phone number (e.g. 07xxx xxxxxx).");
      return;
    }
    if (form.party > 1 && !form.consent) {
      setError("Confirm everyone joining has agreed to be in the session.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // Check if this is first-time booker who needs to sign waiver
      const waiverCheck = await api(\`/api/waiver/status/\${encodeURIComponent(form.phone.trim())}\`);
      if (!waiverCheck.signed) {
        setStep("waiver");
        setBusy(false);
        return;
      }

      const r = await api(\`/api/credits/\${encodeURIComponent(form.phone.trim())}\`);
      setCreditBalance(r.credits);
      // Check if this is a first booking
      const firstBookingCheck = await api(\`/api/is-first-booking/\${encodeURIComponent(form.phone.trim())}\`);
      setIsFirstBooking(firstBookingCheck.isFirstBooking);
      if (r.credits > 0) {
        setPayMethod("credit");
        setStep("choice");
      } else {
        setPayMethod("session");
        setStep("payment");
      }
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const guestFee = (form.party - 1) * cfg.GUEST_PRICE;
  const amountDue = payMethod === "credit" ? guestFee : cfg.PRICE_GBP + guestFee;

  async function book(useCredit) {
    setBusy(true);
    setError("");
    try {
      const r = await post("/api/book", {
        date: key,
        slot: modalSlot,
        name: form.name.trim(),
        phone: form.phone.trim(),
        party: form.party,
        useCredit,
      });
      if (r.status === "redirect") {
        window.location.href = r.url; // off to pay (Stripe, or practice mode)
        return;
      }
      if (r.status === "confirmed") {
        setConfirmedInfo({
          dateLabel: fmtDay(days[selectedDay]),
          timeLabel: fmtTime(modalSlot),
          party: form.party,
          viaCredit: useCredit,
          guestFee,
        });
        setStep("confirmed");
        refresh();
      }
    } catch (e2) {
      setError(e2.message);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitWaiver(e) {
    e.preventDefault();
    if (!waiverAgreed) {
      setError("You must agree to all terms before proceeding.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await post("/api/waiver/sign", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        agreedToTerms: true,
        optedOutInduction: waiverOptOut,
      });
      // Now continue with booking flow
      const r = await api(\`/api/credits/\${encodeURIComponent(form.phone.trim())}\`);
      setCreditBalance(r.credits);
      // Check if this is a first booking
      const firstBookingCheck = await api(\`/api/is-first-booking/\${encodeURIComponent(form.phone.trim())}\`);
      setIsFirstBooking(firstBookingCheck.isFirstBooking);
      if (r.credits > 0) {
        setPayMethod("credit");
        setStep("choice");
      } else {
        setPayMethod("session");
        setStep("payment");
      }
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  function continueFromChoice() {
    if (payMethod === "credit" && guestFee === 0) {
      book(true); // fully covered — confirms instantly
    } else {
      setStep("payment");
    }
  }

  const bookedCount = SLOTS.filter((m) => taken[m]).length;

  function openMemberModal() {
    setMemberModal("buy");
    setMemberStep("lookup");
    setMemberForm({ name: "", phone: "" });
    setMemberBuyType("membership");
    setMemberError("");
  }
  function closeMemberModal() {
    setMemberModal(null);
  }
  async function submitMemberLookup(e) {
    e.preventDefault();
    if (!memberForm.name.trim() || !memberForm.phone.trim()) {
      setMemberError("Enter your name and phone number.");
      return;
    }
    if (!validPhone(memberForm.phone.trim())) {
      setMemberError("Enter a valid UK phone number (e.g. 07xxx xxxxxx).");
      return;
    }
    if (memberBuyType === "extra") {
      // Extra credits are members-only — check before taking them to payment.
      try {
        const r = await api(\`/api/is-member/\${encodeURIComponent(memberForm.phone.trim())}\`);
        if (!r.member) {
          setMemberError(
            "Extra credits are a top-up for members. Buy a membership first — £40/month includes 8 sessions."
          );
          return;
        }
      } catch (e2) {
        // if the check fails, the server enforces it at payment anyway
      }
    }
    setMemberError("");
    setMemberStep("payment");
  }
  async function confirmMemberPurchase() {
    setBusy(true);
    setMemberError("");
    try {
      const r = await post("/api/buy-credits", {
        name: memberForm.name.trim(),
        phone: memberForm.phone.trim(),
        type: memberBuyType,
        qty: extraQty,
      });
      if (r.status === "redirect") window.location.href = r.url;
    } catch (e2) {
      setMemberError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function reserveForOwner() {
    setBusy(true);
    try {
      await post("/api/owner/block", {
        passcode: ownerPass,
        date: key,
        slot: modalSlot,
        label: ownerLabel.trim() || "Personal training",
      });
      closeModal();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function releaseSlot() {
    setBusy(true);
    try {
      await post("/api/owner/release", { passcode: ownerPass, date: key, slot: modalSlot });
      closeModal();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function submitOwnerPasscode(e) {
    e.preventDefault();
    try {
      await post("/api/owner/login", { passcode: ownerInput });
      setOwnerPass(ownerInput);
      setOwnerMode(true);
      setOwnerPromptOpen(false);
      setOwnerInput("");
      setOwnerError("");
    } catch (e2) {
      setOwnerError("Wrong passcode.");
    }
  }

  const memberAmount =
    memberBuyType === "membership" ? cfg.MEMBERSHIP_PRICE : cfg.EXTRA_CREDIT_PRICE * extraQty;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.freeSessionBanner}>
          🎉 Everyone's first session is FREE
        </div>
        <header style={styles.header}>
          <div style={styles.logoWrap}>
            <img src="/logo.png" alt="The Hall Farm Gym" style={styles.logo} />
          </div>
          <div style={styles.brandRow}>
            <div>
              <div style={styles.eyebrow}>PRIVATE HIRE</div>
              <h1 style={styles.title}>The room is only ever yours</h1>
            </div>
          </div>
          <p style={styles.sub}>
            Every booking closes the door on everyone else — unless you choose to bring people
            in with you. Open 6am–10pm, daily. 40 minute sessions, 5 minutes to reset the room
            between each one. Bring up to {cfg.MAX_PARTY - 1} people for £{cfg.GUEST_PRICE} each,
            with everyone's consent.
          </p>
          <button style={styles.membershipBtn} onClick={openMemberModal}>
            <span style={styles.membershipBtnTitle}>Buy membership</span>
            <span style={styles.membershipBtnSub}>
              £{cfg.MEMBERSHIP_PRICE}/month for {cfg.MEMBERSHIP_CREDITS} sessions · or top up
              extra credits at £{cfg.EXTRA_CREDIT_PRICE} each
            </span>
          </button>
          <button
            style={styles.ownerLink}
            onClick={() => (ownerMode ? (setOwnerMode(false), setOwnerPass("")) : setOwnerPromptOpen(true))}
          >
            {ownerMode ? "Exit owner mode" : "Owner login"}
          </button>
        </header>

        {cfg.practiceMode && (
          <div style={styles.practiceBanner}>
            Practice mode — payments are simulated. Add your Stripe key in the .env file to take
            real card payments.
          </div>
        )}

        {banner && (
          <div style={styles.confirmBanner}>
            {banner.kind === "booking" && (
              <span>
                <strong>Booked. It's yours.</strong> {banner.dateLabel}, {banner.timeLabel}
                {banner.party > 1 ? \`, \${banner.party} people\` : ""}. Payment received.
              </span>
            )}
            {banner.kind === "credits" && (
              <span>
                <strong>Credits added.</strong>{" "}
                {banner.balance != null
                  ? \`\${banner.name || "You"} now \${banner.name ? "has" : "have"} \${banner.balance} credit\${
                      banner.balance === 1 ? "" : "s"
                    } this month. Use the same phone number when booking.\`
                  : "Payment received. Use the same phone number when booking."}
              </span>
            )}
            {banner.kind === "cancelled" && (
              <span>Payment cancelled — nothing was charged, the slot was not booked.</span>
            )}
            <button style={styles.bannerClose} onClick={() => setBanner(null)} aria-label="Dismiss">
              <XIcon size={14} />
            </button>
          </div>
        )}

        <div style={styles.daySelector}>
          <button
            style={styles.dayArrow}
            onClick={() => setDayOffset((o) => Math.max(0, o - 4))}
            aria-label="Earlier days"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <div style={styles.dayList}>
            {days.slice(dayOffset, dayOffset + 4).map((d, i) => {
              const idx = dayOffset + i;
              const active = idx === selectedDay;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(idx)}
                  style={{ ...styles.dayChip, ...(active ? styles.dayChipActive : {}) }}
                >
                  <div>{fmtDay(d)}</div>
                </button>
              );
            })}
          </div>
          <button
            style={styles.dayArrow}
            onClick={() => setDayOffset((o) => Math.min(days.length - 4, o + 4))}
            aria-label="Later days"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>

        {ownerMode && (
          <div style={styles.ownerBanner}>
            Owner mode — tap any slot to block it out for PT or personal use, or tap a taken slot
            to see who booked it and release it.
          </div>
        )}

        <div style={styles.slotsHeaderRow}>
          <span style={styles.slotsHeaderTitle}>{days[selectedDay] && fmtDay(days[selectedDay])}</span>
          <span style={styles.slotsHeaderMeta}>
            {bookedCount} of {SLOTS.length} slots reserved
          </span>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading availability…</div>
        ) : (
          <div style={styles.slotGrid}>
            {SLOTS.map((mins) => {
              const booking = taken[mins];
              const isTaken = !!booking;
              const isOwnerSlot = booking?.via === "owner";
              const detail = ownerDay[mins];
              return (
                <button
                  key={mins}
                  disabled={isTaken && !ownerMode}
                  onClick={() => openSlot(mins)}
                  style={{
                    ...styles.slot,
                    ...(isTaken ? styles.slotTaken : styles.slotFree),
                    ...(isTaken && ownerMode ? styles.slotOwnerEditable : {}),
                  }}
                >
                  <span style={styles.slotTime}>{fmtTime(mins)}</span>
                  <span style={styles.slotSub}>
                    {isTaken
                      ? isOwnerSlot
                        ? \`Blocked · \${booking.label || "Owner"}\`
                        : ownerMode && detail
                        ? \`Reserved · \${detail.name}\`
                        : "Reserved"
                      : \`\${cfg.SESSION_MIN} min · available\`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <section style={styles.infoCard}>
          <div style={styles.modalEyebrow}>PERSONAL TRAINING</div>
          <h2 style={styles.infoTitle}>Build strength with someone who gets it</h2>
          <div style={styles.imageGallery}>
            <img src="/rugby-team.png" alt="Rugby team" style={styles.galleryImage} />
            <img src="/rugby-grad.jpg" alt="Graduation" style={styles.galleryImage} />
          </div>
          <p style={styles.infoText}>
            I'm Peter, 22, a Level 3 Personal Trainer and Level 2 Gym Instructor with a degree (honours) in Strength & Conditioning. I play rugby and work with people who want real results — whether that's building strength for the sport, improving technique, or getting genuinely stronger.
          </p>
          <p style={styles.infoText}>
            I've been through ACL reconstruction after a rugby injury, and that's shaped how I approach training. I'm passionate about prehab and rehab — preventing injuries before they happen, and rebuilding properly after. Every session is tailored to you, your goals, and where you're starting from. No generic plans. Just proper coaching.
          </p>
          <div style={styles.infoBtnRow}>
            <a
              href="https://wa.me/447376246998?text=Hi%2C%20I%27d%20like%20to%20ask%20about%20personal%20training%20at%20The%20Hall%20Farm%20Gym"
              style={styles.infoBtn}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp 07376 246998
            </a>
            <a
              href="mailto:WrayFitness04@gmail.com?subject=Personal%20training%20enquiry"
              style={styles.infoBtnGhost}
            >
              Email WrayFitness04@gmail.com
            </a>
          </div>
        </section>

        <section style={{ ...styles.infoCard, textAlign: "center" }}>
          <div style={styles.modalEyebrow}>FARM BOOTCAMPS</div>
          <h2 style={{ ...styles.infoTitle, marginBottom: 4 }}>Coming soon</h2>
          <p style={{ ...styles.infoText, marginBottom: 0 }}>
            Group sessions in the open air, farm-style. Watch this space.
          </p>
        </section>

        <footer style={styles.footer}>
          The Hall Farm Gym, The Hall, Stapleford, LN6 9JY
          <br />
          Part of R Wray &amp; Sons Ltd — rwrayandsonsltd.com
        </footer>
      </div>

      {modalSlot !== null && (
        <div style={styles.overlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={closeModal} aria-label="Close">
              <XIcon size={18} />
            </button>

            {step === "waiver" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>TERMS & CONDITIONS</div>
                <h2 style={styles.modalTitle}>{WAIVER_TEXT.title}</h2>
                <p style={styles.modalSub}>{WAIVER_TEXT.subtitle}</p>

                <div style={styles.waiverContent}>
                  {WAIVER_TEXT.sections.map((section, idx) => (
                    <div key={idx} style={styles.waiverSection}>
                      <h3 style={styles.waiverSectionTitle}>{section.title}</h3>
                      <ul style={styles.waiverPoints}>
                        {section.points.map((point, i) => (
                          <li key={i} style={styles.waiverPoint}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <form onSubmit={submitWaiver} style={styles.form}>
                  <label style={styles.consentRow}>
                    <input
                      type="checkbox"
                      checked={waiverAgreed}
                      onChange={(e) => setWaiverAgreed(e.target.checked)}
                    />
                    <span>I agree to all the above terms and accept responsibility for my safety</span>
                  </label>

                  <label style={styles.consentRow}>
                    <input
                      type="checkbox"
                      checked={waiverOptOut}
                      onChange={(e) => setWaiverOptOut(e.target.checked)}
                    />
                    <span>I opt out of gym induction (I understand I am responsible for safe equipment use)</span>
                  </label>

                  {error && <div style={styles.errorText}>{error}</div>}
                  <button type="submit" style={styles.primaryBtn} disabled={!waiverAgreed || busy}>
                    {busy ? "One moment…" : "I agree & continue"}
                  </button>
                </form>
              </React.Fragment>
            )}

            {step === "details" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>YOUR SLOT</div>
                <h2 style={styles.modalTitle}>
                  {fmtDay(days[selectedDay])}, {fmtTime(modalSlot)}
                </h2>
                <p style={styles.modalSub}>
                  40 minutes, room to yourself. Pay £{cfg.PRICE_GBP} or use 1 membership credit.
                </p>
                <div style={styles.infoNotice}>
                  All children under 16 must be accompanied by an adult at all times.
                </div>
                <form onSubmit={submitDetails} style={styles.form}>
                  <label style={styles.label}>
                    Name
                    <input
                      style={styles.input}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </label>
                  <label style={styles.label}>
                    Phone
                    <input
                      style={styles.input}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="07…"
                    />
                  </label>

                  <div style={styles.label}>
                    Bringing anyone with you? (max {cfg.MAX_PARTY} total)
                    <div style={styles.qtyControls}>
                      <button
                        type="button"
                        style={styles.qtyBtn}
                        onClick={() => setForm((f) => ({ ...f, party: Math.max(1, f.party - 1) }))}
                      >
                        −
                      </button>
                      <span style={styles.qtyValue}>{form.party}</span>
                      <button
                        type="button"
                        style={styles.qtyBtn}
                        onClick={() =>
                          setForm((f) => ({ ...f, party: Math.min(cfg.MAX_PARTY, f.party + 1) }))
                        }
                      >
                        +
                      </button>
                      <span style={styles.choiceSub}>
                        {form.party === 1
                          ? "Just you"
                          : \`+£\${(form.party - 1) * cfg.GUEST_PRICE} for \${form.party - 1} extra \${
                              form.party - 1 === 1 ? "person" : "people"
                            }\`}
                      </span>
                    </div>
                  </div>

                  {form.party > 1 && (
                    <label style={styles.consentRow}>
                      <input
                        type="checkbox"
                        checked={form.consent}
                        onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                      />
                      <span>
                        Everyone joining has agreed to share this session with the group — this
                        isn't a private slot for them once others are in the room.
                      </span>
                    </label>
                  )}

                  {error && <div style={styles.errorText}>{error}</div>}
                  <button type="submit" style={styles.primaryBtn} disabled={busy}>
                    {busy ? "One moment…" : "Continue"}
                  </button>
                </form>
              </React.Fragment>
            )}

            {step === "choice" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>HOW WOULD YOU LIKE TO PAY</div>
                <h2 style={styles.modalTitle}>
                  {fmtDay(days[selectedDay])}, {fmtTime(modalSlot)}
                </h2>
                <p style={styles.modalSub}>
                  {form.name} has {creditBalance} credit{creditBalance === 1 ? "" : "s"} available
                  this month.
                </p>
                <div style={styles.choiceRow}>
                  <button
                    style={{
                      ...styles.choiceCard,
                      ...(payMethod === "credit" ? styles.choiceCardActive : {}),
                    }}
                    onClick={() => setPayMethod("credit")}
                  >
                    <div style={styles.choiceTitle}>Use 1 credit</div>
                    <div style={styles.choiceSub}>
                      {guestFee > 0 ? \`£\${guestFee} guest fee today\` : "No charge today"}
                    </div>
                  </button>
                  <button
                    style={{
                      ...styles.choiceCard,
                      ...(payMethod === "session" ? styles.choiceCardActive : {}),
                    }}
                    onClick={() => setPayMethod("session")}
                  >
                    <div style={styles.choiceTitle}>Pay £{cfg.PRICE_GBP + guestFee}</div>
                    <div style={styles.choiceSub}>Keep the credit</div>
                  </button>
                </div>
                {error && <div style={styles.errorText}>{error}</div>}
                <button style={styles.primaryBtn} onClick={continueFromChoice} disabled={busy}>
                  {busy ? "One moment…" : "Continue"}
                </button>
              </React.Fragment>
            )}

            {step === "payment" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}}>{isFirstBooking ? "FIRST SESSION" : "PAYMENT"}</div>
                <h2 style={styles.modalTitle}>{isFirstBooking ? "✓ FREE" : \`£\${amountDue}.00\`}</h2>
                <p style={styles.modalSub}>
                  {fmtDay(days[selectedDay])}, {fmtTime(modalSlot)} · {form.name}
                  {form.party > 1 ? \` · \${form.party} people\` : ""}
                  {payMethod === "credit" ? " · 1 credit + guest fee" : ""}
                  {isFirstBooking ? " · everyone's first session is included" : ""}
                </p>
                {!isFirstBooking && (
                  <div style={styles.payNotice}>
                    <CardIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      {cfg.practiceMode
                        ? "Practice mode — this will simulate the payment so you can test the flow. No real money moves."
                        : "You'll be taken to a secure Stripe page to pay by card. Your slot is held for 15 minutes while you pay."}
                    </span>
                  </div>
                )}
                {error && <div style={styles.errorText}>{error}</div>}
                <button
                  style={styles.primaryBtn}
                  onClick={() => book(payMethod === "credit")}
                  disabled={busy}
                >
                  {busy
                    ? "One moment…"
                    : isFirstBooking
                    ? "Confirm your free session"
                    : cfg.practiceMode
                    ? "Simulate payment & confirm"
                    : \`Pay £\${amountDue}.00 securely\`}
                </button>
              </React.Fragment>
            )}

            {step === "ownerReserve" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>OWNER · BLOCK SLOT</div>
                <h2 style={styles.modalTitle}>
                  {fmtDay(days[selectedDay])}, {fmtTime(modalSlot)}
                </h2>
                <p style={styles.modalSub}>
                  Takes this slot off public booking. No payment involved.
                </p>
                <label style={styles.label}>
                  What's it for?
                  <input
                    style={styles.input}
                    value={ownerLabel}
                    onChange={(e) => setOwnerLabel(e.target.value)}
                    placeholder="e.g. Personal training — Sam"
                  />
                </label>
                {error && <div style={styles.errorText}>{error}</div>}
                <button
                  style={{ ...styles.primaryBtn, marginTop: 14 }}
                  onClick={reserveForOwner}
                  disabled={busy}
                >
                  Block this slot
                </button>
              </React.Fragment>
            )}

            {step === "ownerRelease" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>OWNER · MANAGE SLOT</div>
                <h2 style={styles.modalTitle}>
                  {fmtDay(days[selectedDay])}, {fmtTime(modalSlot)}
                </h2>
                <p style={styles.modalSub}>
                  {ownerDay[modalSlot]
                    ? \`Currently: \${ownerDay[modalSlot].name}\${
                        ownerDay[modalSlot].phone ? \` · \${ownerDay[modalSlot].phone}\` : ""
                      }\${ownerDay[modalSlot].party > 1 ? \` · \${ownerDay[modalSlot].party} people\` : ""}\${
                        ownerDay[modalSlot].via === "credit"
                          ? " · paid with credit"
                          : ownerDay[modalSlot].via === "session"
                          ? \` · paid £\${(ownerDay[modalSlot].amount_pence / 100).toFixed(2)}\`
                          : ""
                      }\`
                    : "Currently: Reserved"}
                </p>
                {error && <div style={styles.errorText}>{error}</div>}
                <button style={styles.primaryBtn} onClick={releaseSlot} disabled={busy}>
                  Release this slot
                </button>
              </React.Fragment>
            )}

            {step === "confirmed" && confirmedInfo && (
              <div style={styles.confirmedWrap}>
                <div style={styles.confirmedIcon}>
                  <CheckIcon size={22} color="#EAE3D6" />
                </div>
                <h2 style={styles.modalTitle}>Booked. It's yours.</h2>
                <p style={styles.modalSub}>
                  {confirmedInfo.dateLabel}, {confirmedInfo.timeLabel}
                  {confirmedInfo.party > 1 ? \`, \${confirmedInfo.party} people\` : ""}.{" "}
                  {confirmedInfo.viaCredit ? "1 credit used." : "Payment received."}
                </p>
                <button style={styles.primaryBtn} onClick={closeModal}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {memberModal === "buy" && (
        <div style={styles.overlay} onClick={closeMemberModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeBtn} onClick={closeMemberModal} aria-label="Close">
              <XIcon size={18} />
            </button>

            {memberStep === "lookup" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>MEMBERSHIP &amp; CREDITS</div>
                <h2 style={styles.modalTitle}>Buy sessions in bulk</h2>
                <div style={styles.choiceRow}>
                  <button
                    style={{
                      ...styles.choiceCard,
                      ...(memberBuyType === "membership" ? styles.choiceCardActive : {}),
                    }}
                    onClick={() => setMemberBuyType("membership")}
                  >
                    <div style={styles.choiceTitle}>Membership</div>
                    <div style={styles.choiceSub}>
                      £{cfg.MEMBERSHIP_PRICE}/mo · {cfg.MEMBERSHIP_CREDITS} credits
                    </div>
                  </button>
                  <button
                    style={{
                      ...styles.choiceCard,
                      ...(memberBuyType === "extra" ? styles.choiceCardActive : {}),
                    }}
                    onClick={() => setMemberBuyType("extra")}
                  >
                    <div style={styles.choiceTitle}>Extra credits</div>
                    <div style={styles.choiceSub}>
                      £{cfg.EXTRA_CREDIT_PRICE} each · members only
                    </div>
                  </button>
                </div>

                {memberBuyType === "extra" && (
                  <div style={styles.qtyRow}>
                    <span style={styles.label}>How many credits?</span>
                    <div style={styles.qtyControls}>
                      <button
                        style={styles.qtyBtn}
                        onClick={() => setExtraQty((q) => Math.max(1, q - 1))}
                      >
                        −
                      </button>
                      <span style={styles.qtyValue}>{extraQty}</span>
                      <button style={styles.qtyBtn} onClick={() => setExtraQty((q) => Math.min(20, q + 1))}>
                        +
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={submitMemberLookup} style={styles.form}>
                  <label style={styles.label}>
                    Name
                    <input
                      style={styles.input}
                      value={memberForm.name}
                      onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="Your name"
                    />
                  </label>
                  <label style={styles.label}>
                    Phone
                    <input
                      style={styles.input}
                      value={memberForm.phone}
                      onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                      placeholder="07… (used to find your credits when booking)"
                    />
                  </label>
                  {memberError && <div style={styles.errorText}>{memberError}</div>}
                  <button type="submit" style={styles.primaryBtn}>
                    Continue to payment
                  </button>
                </form>
              </React.Fragment>
            )}

            {memberStep === "payment" && (
              <React.Fragment>
                <div style={styles.modalEyebrow}>PAYMENT</div>
                <h2 style={styles.modalTitle}>£{memberAmount}.00</h2>
                <p style={styles.modalSub}>
                  {memberBuyType === "membership"
                    ? \`\${cfg.MEMBERSHIP_CREDITS} credits · \${memberForm.name}\`
                    : \`\${extraQty} credit\${extraQty === 1 ? "" : "s"} · \${memberForm.name}\`}
                </p>
                <div style={styles.payNotice}>
                  <CardIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {cfg.practiceMode
                      ? "Practice mode — this will simulate the payment so you can test the flow. No real money moves."
                      : "You'll be taken to a secure Stripe page to pay by card. Credits are added the moment payment goes through."}
                  </span>
                </div>
                {memberError && <div style={styles.errorText}>{memberError}</div>}
                <button style={styles.primaryBtn} onClick={confirmMemberPurchase} disabled={busy}>
                  {busy
                    ? "One moment…"
                    : cfg.practiceMode
                    ? "Simulate payment & confirm"
                    : \`Pay £\${memberAmount}.00 securely\`}
                </button>
              </React.Fragment>
            )}
          </div>
        </div>
      )}

      {ownerPromptOpen && (
        <div style={styles.overlay} onClick={() => setOwnerPromptOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              style={styles.closeBtn}
              onClick={() => setOwnerPromptOpen(false)}
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>
            <div style={styles.modalEyebrow}>OWNER LOGIN</div>
            <h2 style={styles.modalTitle}>Enter passcode</h2>
            <p style={styles.modalSub}>
              Lets you block out slots for personal training ahead of public booking.
            </p>
            <form onSubmit={submitOwnerPasscode} style={styles.form}>
              <input
                style={styles.input}
                type="password"
                value={ownerInput}
                onChange={(e) => setOwnerInput(e.target.value)}
                placeholder="Passcode"
                autoFocus
              />
              {ownerError && <div style={styles.errorText}>{ownerError}</div>}
              <button type="submit" style={styles.primaryBtn}>
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#1C2320",
    color: "#EAE3D6",
    fontFamily: "'Georgia', 'Iowan Old Style', serif",
    padding: "0",
  },
  container: { maxWidth: 520, margin: "0 auto", padding: "32px 20px 60px" },
  freeSessionBanner: {
    background: "#2A3A32", color: "#A8D5BA", padding: "12px 16px", borderRadius: 10,
    fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 16,
    fontFamily: "'Helvetica Neue', Arial, sans-serif", border: "1px solid #3A4A42",
  },
  header: { marginBottom: 24 },
  logoWrap: { display: "flex", justifyContent: "center", marginBottom: 18 },
  logo: { width: "100%", maxWidth: 300, height: "auto", display: "block" },
  brandRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  lockBadge: {
    width: 34, height: 34, borderRadius: "50%", background: "#3A4A42",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  eyebrow: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 11, letterSpacing: "2px", color: "#9BB0A4", fontWeight: 600,
  },
  title: { fontSize: 24, margin: "2px 0 0", fontWeight: 400, lineHeight: 1.25 },
  sub: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 14.5, lineHeight: 1.6, color: "#B9C4BC", margin: 0,
  },
  membershipBtn: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    display: "flex", flexDirection: "column", gap: 3, width: "100%",
    background: "#25D366", border: "none", borderRadius: 10,
    padding: "13px 16px", marginTop: 16, cursor: "pointer", textAlign: "left",
  },
  membershipBtnTitle: { fontSize: 15, fontWeight: 700, color: "#0F1512" },
  membershipBtnSub: { fontSize: 12, color: "#1C2320", opacity: 0.85 },
  ownerLink: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "none", border: "none", color: "#5A655D", fontSize: 11,
    padding: 0, marginTop: 10, cursor: "pointer", textAlign: "left", display: "block",
  },
  ownerBanner: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#3A4A42", border: "1px solid #5C7267", borderRadius: 10,
    padding: "10px 14px", fontSize: 12.5, color: "#EAE3D6", marginBottom: 14,
  },
  practiceBanner: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#2A2416", border: "1px solid #5C5330", borderRadius: 10,
    padding: "10px 14px", fontSize: 12.5, color: "#D9CB9E", marginBottom: 14,
  },
  confirmBanner: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#233327", border: "1px solid #3F5C48", borderRadius: 10,
    padding: "12px 40px 12px 14px", fontSize: 13, color: "#CBE3D2",
    marginBottom: 14, lineHeight: 1.5, position: "relative",
  },
  bannerClose: {
    position: "absolute", top: 10, right: 10, background: "none",
    border: "none", color: "#CBE3D2", cursor: "pointer",
  },
  daySelector: { display: "flex", alignItems: "center", gap: 8, marginBottom: 18 },
  dayArrow: {
    background: "none", border: "1px solid #3A4A42", borderRadius: 8,
    color: "#EAE3D6", width: 32, height: 32, display: "flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
  dayList: { display: "flex", gap: 8, flex: 1, overflowX: "auto" },
  dayChip: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#232B27", border: "1px solid #354039", borderRadius: 10,
    color: "#B9C4BC", padding: "8px 12px", fontSize: 12.5, cursor: "pointer",
    whiteSpace: "nowrap", flexShrink: 0,
  },
  dayChipActive: {
    background: "#3A4A42", borderColor: "#5C7267", color: "#EAE3D6", fontWeight: 600,
  },
  slotsHeaderRow: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    marginBottom: 10, fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  slotsHeaderTitle: { fontSize: 15, fontWeight: 600, color: "#EAE3D6" },
  slotsHeaderMeta: { fontSize: 12, color: "#7D9184" },
  loading: { color: "#7D9184", fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 14 },
  slotGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  slot: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    borderRadius: 10, padding: "12px 14px", textAlign: "left", cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 3,
  },
  slotFree: { background: "#232B27", border: "1px solid #3A4A42", color: "#EAE3D6" },
  slotTaken: {
    background: "#1A1F1C", border: "1px solid #262E29", color: "#5A655D", cursor: "not-allowed",
  },
  slotOwnerEditable: { cursor: "pointer", borderColor: "#5C7267", color: "#B9C4BC" },
  slotTime: { fontSize: 15, fontWeight: 600 },
  slotSub: { fontSize: 11.5 },
  infoCard: {
    background: "#232B27", border: "1px solid #3A4A42", borderRadius: 14,
    padding: "20px 18px", marginTop: 22,
  },
  infoTitle: { fontSize: 19, fontWeight: 400, margin: "0 0 8px" },
  infoText: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 13.5, lineHeight: 1.6, color: "#B9C4BC", margin: "0 0 14px",
  },
  infoBtnRow: { display: "flex", flexDirection: "column", gap: 8 },
  infoBtn: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    display: "block", textAlign: "center", background: "#25D366",
    borderRadius: 10, color: "#0F1512", fontWeight: 700, fontSize: 13.5,
    padding: "12px 10px", textDecoration: "none",
  },
  infoBtnGhost: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    display: "block", textAlign: "center", background: "#1A1F1C",
    border: "1px solid #3A4A42", borderRadius: 10, color: "#EAE3D6",
    fontWeight: 600, fontSize: 13.5, padding: "11px 10px", textDecoration: "none",
  },
  imageGallery: {
    display: "flex", gap: 10, marginBottom: 14, width: "100%",
  },
  galleryImage: {
    flex: 1, width: "100%", height: "auto", borderRadius: 10, objectFit: "cover", maxHeight: 250,
  },
  footer: {
    marginTop: 34, textAlign: "center",
    fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 12, color: "#5A655D",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(10,13,11,0.72)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
  },
  modal: {
    background: "#232B27", borderTop: "1px solid #3A4A42",
    borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520,
    padding: "28px 22px 32px", position: "relative", color: "#EAE3D6",
  },
  closeBtn: {
    position: "absolute", top: 16, right: 16, background: "none",
    border: "none", color: "#B9C4BC", cursor: "pointer",
  },
  modalEyebrow: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 11, letterSpacing: "2px", color: "#9BB0A4", fontWeight: 600, marginBottom: 6,
  },
  modalTitle: { fontSize: 22, fontWeight: 400, margin: "0 0 6px" },
  modalSub: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 13.5, color: "#B9C4BC", marginBottom: 18,
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  label: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 12, color: "#9BB0A4", display: "flex", flexDirection: "column", gap: 6,
  },
  input: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#1A1F1C", border: "1px solid #3A4A42", borderRadius: 8,
    padding: "11px 12px", color: "#EAE3D6", fontSize: 14,
  },
  errorText: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#D98484", fontSize: 12.5,
  },
  primaryBtn: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#25D366", border: "none", borderRadius: 10, color: "#0F1512",
    fontWeight: 700, fontSize: 14.5, padding: "13px 0", cursor: "pointer", marginTop: 4,
  },
  payNotice: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#1A1F1C", border: "1px solid #3A4A42", borderRadius: 10,
    padding: 14, fontSize: 12.5, color: "#B9C4BC", display: "flex",
    gap: 10, lineHeight: 1.5, marginBottom: 18,
  },
  infoNotice: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#2A3A32", border: "1px solid #3A4A42", borderRadius: 10,
    padding: 12, fontSize: 12.5, color: "#B9C4BC", marginBottom: 18, lineHeight: 1.5,
  },
  choiceRow: { display: "flex", gap: 10, marginBottom: 18 },
  choiceCard: {
    flex: 1, fontFamily: "'Helvetica Neue', Arial, sans-serif",
    background: "#1A1F1C", border: "1px solid #3A4A42", borderRadius: 10,
    padding: "12px 14px", textAlign: "left", cursor: "pointer", color: "#EAE3D6",
  },
  choiceCardActive: { background: "#3A4A42", borderColor: "#5C7267" },
  choiceTitle: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  choiceSub: { fontSize: 11.5, color: "#B9C4BC" },
  consentRow: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12,
    color: "#B9C4BC", lineHeight: 1.5,
  },
  qtyRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
  },
  qtyControls: { display: "flex", alignItems: "center", gap: 12 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 8, border: "1px solid #3A4A42",
    background: "#1A1F1C", color: "#EAE3D6", fontSize: 16, cursor: "pointer",
  },
  qtyValue: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 15, fontWeight: 700, minWidth: 20, textAlign: "center",
  },
  confirmedWrap: { textAlign: "center", paddingTop: 8 },
  confirmedIcon: {
    width: 44, height: 44, borderRadius: "50%", background: "#3A4A42",
    display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
  },
  waiverContent: {
    maxHeight: "300px", overflowY: "auto", marginBottom: 18, paddingRight: 8,
    background: "#1A1F1C", borderRadius: 10, padding: "14px", border: "1px solid #3A4A42",
  },
  waiverSection: { marginBottom: 14 },
  waiverSectionTitle: {
    fontSize: 12.5, fontWeight: 700, color: "#25D366", marginBottom: 8,
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  waiverPoints: {
    fontSize: 12, color: "#B9C4BC", lineHeight: 1.6, paddingLeft: 16, margin: 0,
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  waiverPoint: { marginBottom: 6 },
};

ReactDOM.createRoot(document.getElementById("root")).render(<GymBooking />);
`;
fs.writeFileSync('$HOME/mnt/Documents/HallFarmGym/public/app.jsx', content, 'utf8');
console.log('✓ app.jsx written successfully');
