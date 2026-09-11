-- VKV Factory Management — Database Setup
-- Run this ONCE in Supabase → SQL Editor → New Query → Paste → Run

-- ── Purchases table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  requested_by     TEXT NOT NULL,
  item             TEXT NOT NULL,
  quantity         NUMERIC,
  unit             TEXT,
  amount           NUMERIC NOT NULL,
  supplier         TEXT,
  urgency          TEXT DEFAULT 'Normal',
  notes            TEXT,
  status           TEXT DEFAULT 'Approved',
  rejection_reason TEXT,
  photo_url        TEXT,
  logged_by        TEXT
);

-- ── Petty cash table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS petty_cash (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  office     TEXT NOT NULL,
  entered_by TEXT NOT NULL,
  amount     NUMERIC NOT NULL,
  paid_to    TEXT,
  purpose    TEXT NOT NULL,
  category   TEXT,
  notes      TEXT,
  photo_url  TEXT,
  logged_by  TEXT
);

-- ── Row Level Security (only logged-in users can read/write) ─────────────────
ALTER TABLE purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users only" ON purchases
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users only" ON petty_cash
  FOR ALL USING (auth.role() = 'authenticated');
