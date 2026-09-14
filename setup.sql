-- ==============================================================================
-- VKV Factory Management — Database & Storage Setup / Migration
-- ==============================================================================
-- Run this in Supabase: Project Dashboard → SQL Editor → New Query → Run.
-- This script is idempotent: safe to run on a brand-new project or an existing database.
-- ==============================================================================

-- ── 1. Allowed Emails / Database-Level Authorization ──────────────────────────
-- Only emails listed in allowed_emails are granted database read/write access.
CREATE TABLE IF NOT EXISTS allowed_emails (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current authenticated user's email is authorized.
-- Runs as SECURITY DEFINER so RLS evaluations can read allowed_emails without recursion.
CREATE OR REPLACE FUNCTION is_allowed_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;

DROP POLICY IF EXISTS "Authorized users can read allowed_emails" ON allowed_emails;
CREATE POLICY "Authorized users can read allowed_emails" ON allowed_emails
  FOR SELECT TO authenticated
  USING (is_allowed_user());

-- FIRST-RUN SETUP:
-- Replace with the administrator / owner emails allowed to access VKV Factory:
-- INSERT INTO allowed_emails (email) VALUES
--   ('kavinrajt@gmail.com')
-- ON CONFLICT (email) DO NOTHING;


-- ── 2. Purchases Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  transaction_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
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

-- Migration for existing purchases tables:
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS transaction_date DATE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS logged_by TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Backfill transaction_date from created_at in Asia/Kolkata timezone:
UPDATE purchases
SET transaction_date = (created_at AT TIME ZONE 'Asia/Kolkata')::DATE
WHERE transaction_date IS NULL;

ALTER TABLE purchases
  ALTER COLUMN transaction_date
  SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;


-- ── 3. Petty Cash Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS petty_cash (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id         TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  transaction_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
  office           TEXT NOT NULL,
  entered_by       TEXT NOT NULL DEFAULT '',
  amount           NUMERIC NOT NULL,
  paid_to          TEXT,
  purpose          TEXT NOT NULL,
  category         TEXT,
  notes            TEXT,
  photo_url        TEXT,
  logged_by        TEXT
);

-- Migration for existing petty_cash tables:
ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS transaction_date DATE;
ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS logged_by TEXT;
ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS entered_by TEXT DEFAULT '';
ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Backfill transaction_date from created_at in Asia/Kolkata timezone:
UPDATE petty_cash
SET transaction_date = (created_at AT TIME ZONE 'Asia/Kolkata')::DATE
WHERE transaction_date IS NULL;

ALTER TABLE petty_cash
  ALTER COLUMN transaction_date
  SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;


-- ── 4. Cash Ledger Entries Table (Bulk Markdown Import) ───────────────────────
CREATE TABLE IF NOT EXISTS cash_ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  transaction_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
  office           TEXT NOT NULL,
  purpose          TEXT NOT NULL,
  credit_amount    NUMERIC NOT NULL DEFAULT 0,
  debit_amount     NUMERIC NOT NULL DEFAULT 0,
  notes            TEXT,
  source_filename  TEXT,
  logged_by        TEXT
);

-- Migration-safe column checks for existing tables:
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS transaction_date DATE;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS office TEXT;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS credit_amount NUMERIC DEFAULT 0;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS debit_amount NUMERIC DEFAULT 0;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS source_filename TEXT;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS logged_by TEXT;
ALTER TABLE cash_ledger_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill transaction_date from created_at in Asia/Kolkata timezone if null:
UPDATE cash_ledger_entries
SET transaction_date = (created_at AT TIME ZONE 'Asia/Kolkata')::DATE
WHERE transaction_date IS NULL;

-- Default transaction_date to India Standard Time:
ALTER TABLE cash_ledger_entries
  ALTER COLUMN transaction_date
  SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;

-- Constraints preventing negative amounts and validating non-zero line items:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cash_ledger_credit_non_negative'
  ) THEN
    ALTER TABLE cash_ledger_entries
      ADD CONSTRAINT chk_cash_ledger_credit_non_negative CHECK (credit_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cash_ledger_debit_non_negative'
  ) THEN
    ALTER TABLE cash_ledger_entries
      ADD CONSTRAINT chk_cash_ledger_debit_non_negative CHECK (debit_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cash_ledger_amounts_valid'
  ) THEN
    ALTER TABLE cash_ledger_entries
      ADD CONSTRAINT chk_cash_ledger_amounts_valid CHECK (credit_amount > 0 OR debit_amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cash_ledger_office_valid'
  ) THEN
    ALTER TABLE cash_ledger_entries
      ADD CONSTRAINT chk_cash_ledger_office_valid CHECK (office IN ('VKV', 'Gangapuram'));
  END IF;
END $$;

-- Performance indexes for batch and ledger queries:
CREATE INDEX IF NOT EXISTS idx_cash_ledger_batch_id ON cash_ledger_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_date ON cash_ledger_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_office ON cash_ledger_entries(office);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_created_at ON cash_ledger_entries(created_at DESC);


-- ── 5. Row Level Security for Tables ──────────────────────────────────────────
ALTER TABLE purchases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_ledger_entries ENABLE ROW LEVEL SECURITY;

-- Remove legacy insecure policies that permitted ANY authenticated user:
DROP POLICY IF EXISTS "Authenticated users only" ON purchases;
DROP POLICY IF EXISTS "Authenticated users only" ON petty_cash;
DROP POLICY IF EXISTS "Authorized users read purchases" ON purchases;
DROP POLICY IF EXISTS "Authorized users insert purchases" ON purchases;
DROP POLICY IF EXISTS "Authorized users update purchases" ON purchases;
DROP POLICY IF EXISTS "Authorized users delete purchases" ON purchases;
DROP POLICY IF EXISTS "Authorized users read petty_cash" ON petty_cash;
DROP POLICY IF EXISTS "Authorized users insert petty_cash" ON petty_cash;
DROP POLICY IF EXISTS "Authorized users update petty_cash" ON petty_cash;
DROP POLICY IF EXISTS "Authorized users delete petty_cash" ON petty_cash;
DROP POLICY IF EXISTS "Authorized users read cash_ledger_entries" ON cash_ledger_entries;
DROP POLICY IF EXISTS "Authorized users insert cash_ledger_entries" ON cash_ledger_entries;
DROP POLICY IF EXISTS "Authorized users update cash_ledger_entries" ON cash_ledger_entries;
DROP POLICY IF EXISTS "Authorized users delete cash_ledger_entries" ON cash_ledger_entries;

-- Purchases policies:
CREATE POLICY "Authorized users read purchases" ON purchases
  FOR SELECT TO authenticated
  USING (is_allowed_user());

CREATE POLICY "Authorized users insert purchases" ON purchases
  FOR INSERT TO authenticated
  WITH CHECK (is_allowed_user());

CREATE POLICY "Authorized users update purchases" ON purchases
  FOR UPDATE TO authenticated
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

CREATE POLICY "Authorized users delete purchases" ON purchases
  FOR DELETE TO authenticated
  USING (is_allowed_user());

-- Petty cash policies:
CREATE POLICY "Authorized users read petty_cash" ON petty_cash
  FOR SELECT TO authenticated
  USING (is_allowed_user());

CREATE POLICY "Authorized users insert petty_cash" ON petty_cash
  FOR INSERT TO authenticated
  WITH CHECK (is_allowed_user());

CREATE POLICY "Authorized users update petty_cash" ON petty_cash
  FOR UPDATE TO authenticated
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

CREATE POLICY "Authorized users delete petty_cash" ON petty_cash
  FOR DELETE TO authenticated
  USING (is_allowed_user());

-- Cash ledger entries policies:
CREATE POLICY "Authorized users read cash_ledger_entries" ON cash_ledger_entries
  FOR SELECT TO authenticated
  USING (is_allowed_user());

CREATE POLICY "Authorized users insert cash_ledger_entries" ON cash_ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (is_allowed_user());

CREATE POLICY "Authorized users update cash_ledger_entries" ON cash_ledger_entries
  FOR UPDATE TO authenticated
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

CREATE POLICY "Authorized users delete cash_ledger_entries" ON cash_ledger_entries
  FOR DELETE TO authenticated
  USING (is_allowed_user());


-- ── 6. Private Storage Bucket & Storage RLS ───────────────────────────────────
-- Ensure factory-photos bucket exists and is PRIVATE:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'factory-photos',
  'factory-photos',
  false,
  10485760, -- 10MB file limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Storage policies:
DROP POLICY IF EXISTS "Authorized users read factory photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users upload factory photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users update factory photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users delete factory photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;

CREATE POLICY "Authorized users read factory photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'factory-photos' AND is_allowed_user());

CREATE POLICY "Authorized users upload factory photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'factory-photos' AND is_allowed_user());

CREATE POLICY "Authorized users update factory photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'factory-photos' AND is_allowed_user())
  WITH CHECK (bucket_id = 'factory-photos' AND is_allowed_user());

CREATE POLICY "Authorized users delete factory photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'factory-photos' AND is_allowed_user());
