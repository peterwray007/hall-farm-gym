// ── The Hall Farm Gym — database ─────────────────────────────
// SQLite, stored in gym.db next to this file. Created automatically.

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// DB_PATH lets a cloud host keep the database on permanent storage
// (e.g. DB_PATH=/data/gym.db with a volume mounted at /data).
// With no DB_PATH set, it lives next to this file — same as always.
const dbFile = process.env.DB_PATH || path.join(__dirname, "gym.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    date           TEXT    NOT NULL,          -- YYYY-MM-DD
    slot           INTEGER NOT NULL,          -- minutes from midnight
    name           TEXT    NOT NULL,
    phone          TEXT    NOT NULL DEFAULT '',
    party          INTEGER NOT NULL DEFAULT 1,
    via            TEXT    NOT NULL,          -- 'session' | 'credit' | 'owner'
    status         TEXT    NOT NULL,          -- 'pending' | 'confirmed'
    amount_pence   INTEGER NOT NULL DEFAULT 0,
    used_credit    INTEGER NOT NULL DEFAULT 0,
    stripe_session TEXT,
    created_at     INTEGER NOT NULL,
    UNIQUE(date, slot)
  );

  CREATE TABLE IF NOT EXISTS members (
    phone     TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    credits   REAL NOT NULL DEFAULT 0,       -- REAL to support fractional credits (e.g., 7.5)
    month_key TEXT NOT NULL                  -- YYYY-MM the credits belong to
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    phone          TEXT    NOT NULL,
    name           TEXT    NOT NULL,
    type           TEXT    NOT NULL,          -- 'membership' | 'extra'
    qty            INTEGER NOT NULL,          -- credits granted
    amount_pence   INTEGER NOT NULL,
    status         TEXT    NOT NULL,          -- 'pending' | 'confirmed'
    stripe_session TEXT,
    created_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS waivers (
    phone                 TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    agreed_to_terms       INTEGER NOT NULL,   -- 1 = agreed
    opted_out_induction   INTEGER NOT NULL DEFAULT 0,
    signed_at             INTEGER NOT NULL
  );
`);

// Add member_group column to bookings if it doesn't exist
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN member_group INTEGER NOT NULL DEFAULT 0;`);
} catch (err) {
  // Column likely already exists — safe to ignore
}

module.exports = db;
