# VKV Factory Management System 🏭

A lightweight, mobile-friendly web application designed for a textile wet processing factory in Erode doing job works for Tiruppur and Karur exporters.

The system digitises purchase approvals (chemicals, firewood, spare parts, electrical components) and replaces manual Tamil notebook petty cash bookkeeping (2-wheeler fuels, bus parcels, casual labour, tea/snacks, etc.) with a photo-verified audit trail.

---

## 🌟 Key Features

### 1. Daily Petty Cash Mapping (Notebook & Chit Sheet Digitisation)
- **One Photo → Multi-Transaction Mapping:** Factory staff record expenses in a Tamil physical notebook. You can snap a single picture of the day's notebook page or receipt chit and map all transaction lines under that single photo.
- **Bilingual Purpose Selection:** Dropdown pre-configured with common factory expenses in Tamil and English (e.g. *பெட்ரோல் - 2 Wheeler Fuel*, *பஸ் பார்சல் - Bus Parcel*, *குடிநீர் கேன் - Drinking Water*, *தினசரி கூலி - Casual Labour*, *சிறிய பழுது - Minor Repair*).
- **Auto-Categorisation:** Automatic classification into `Fuel`, `Transport`, `Utilities`, `Welfare`, `Labour`, `Maintenance`, `Admin`, and `Other`.
- **Date Picker & Office Selection:** Log for any specific date across multiple factory units (**VKV** and **Gangapuram**).
- **Day Totals & Filtering:** Automatic live summation of the day's expenses, with quick filtering by date, office, and category.
- **Daily Category Breakdown:** When filtering by date, see category-wise totals and counts at a glance.
- **Edit & Delete:** Correct mistakes on any petty cash entry without re-entering.

### 2. Factory Purchases (Chemicals, Firewood, Spare Parts & Electricals)
- **Bill & Chit Verification:** Upload photo of the supplier invoice, manager chit, or WhatsApp confirmation.
- **Purchase Classification:** Track item name, quantity, unit (kg, litre, bundle, drum, etc.), estimated/paid cost, supplier name, and urgency.
- **Approval Tracking:** Mark as *Approved* or *Rejected* (with mandatory rejection reason).
- **Auto-Generated Ref Codes:** Every purchase receives an identifiable reference code (e.g. `REQ-20260911-4821`).
- **Edit & Delete:** Update any purchase record inline.

### 3. Cash Ledger (Bulk Markdown Import)
- **Markdown Table Import:** Upload a `.md` file containing a Markdown table with columns for Purpose, Credit Amount, Debit Amount, and Notes.
- **Automatic Parsing:** The parser detects header columns, handles currency symbols (₹, Rs, /-), thousand separators, and blank/dash values.
- **Editable Review:** Every parsed row is shown in an editable table before saving — fix typos, adjust amounts, or add/remove rows.
- **Batch Tracking:** Each import gets a unique batch ID. Entries are linked to a specific date, office, and source filename.
- **Totals Validation:** Credit total, debit total, and net balance are displayed during review and after saving.
- **Individual Edit/Delete:** Saved entries can be individually edited or deleted with confirmation dialogs.
- **No OCR/AI:** All data comes from manually typed or prepared Markdown files. OCR and AI extraction are deferred to a future release.

### 4. Factory Owner Dashboard
- Real-time spend overview: Today's and This Month's totals.
- Office-wise breakdown (**VKV vs Gangapuram**).
- Quick actions for single-tap entry on mobile browsers.
- Expandable transaction rows with direct links to full-resolution receipt photos.
- Error handling with retry on data load failures.

### 4. Zero-Friction Authentication
- Single shared access-code login for the factory office.
- The login screen uses a configured Supabase Auth account behind the scenes.
- Whitelist protection: only allowed users can access the system.
- **Database-level authorization:*** RLS policies enforce allowed-email access at the Supabase level, not just in the UI.

### 5. India Standard Time (IST) Date Handling
- All dates use explicit IST timezone logic — no UTC midnight boundary bugs.
- Transaction dates stored as explicit `transaction_date` columns.

### 6. Private Photo Storage
- All photos stored in a **private** Supabase Storage bucket with authenticated signed URLs.
- Only authorised users can view receipt and notebook photos.

---

## 🛠️ Tech Stack

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router, React 18, TypeScript)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security)
- **Storage:** Supabase Storage (**Private** bucket with signed URLs)
- **Auth:** Supabase Passwordless OTP Authentication
- **Auth (login UX):** Shared access-code sign-in backed by Supabase Auth

---

## 📁 Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout with AuthProvider
│   ├── page.tsx                # Factory Owner Dashboard
│   ├── login/page.tsx          # Access-code sign-in page
│   ├── purchase/
│   │   ├── page.tsx            # Purchase list with edit/delete/status filters
│   │   └── new/page.tsx        # Log purchase with bill/chit photo
│   ├── petty-cash/
│   │   ├── page.tsx            # Petty cash log with edit, category breakdown
│   │   └── new/page.tsx        # Daily batch entry & notebook photo mapping
│   └── cash-ledger/
│       └── page.tsx            # Cash ledger Markdown import, review & manage
├── components/
│   ├── AuthGuard.tsx           # Route protection for authorised emails
│   ├── AuthProvider.tsx        # Supabase authentication context
│   ├── Navbar.tsx              # Mobile-responsive navigation header
│   ├── PhotoUpload.tsx         # Drag & drop / mobile camera image picker
│   └── SecurePhoto.tsx         # Authenticated signed URL photo display
├── docs/
│   └── examples/
│       └── cash-ledger.md      # Sample Markdown file for Cash Ledger import
├── lib/
│   ├── cashLedgerParser.ts     # Markdown table parser for Cash Ledger imports
│   ├── constants.ts            # Factory units, bilingual purposes, email checks
│   ├── dateUtils.ts            # IST timezone date utilities
│   ├── firebase.ts             # Supabase client initialisation
│   ├── firestore.ts            # PostgreSQL CRUD & batch transaction handlers
│   └── storage.ts              # Private photo upload + signed URL generation
├── setup.sql                   # Database tables, RLS policies, storage policies
└── types/index.ts              # TypeScript interfaces for all data models
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/kavinthangaraj/vkv-factory.git
cd vkv-factory
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Fill in your Supabase project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_ALLOWED_EMAILS=kavinrajt@gmail.com,brother@gmail.com
```

⚠️ **Important:** If `NEXT_PUBLIC_ALLOWED_EMAILS` is empty or missing, the app will **fail closed** — no one can log in. Always configure at least one admin email.

### 4. Database Setup
In your Supabase project's **SQL Editor**, paste and run the contents of [`setup.sql`](./setup.sql):

This script handles:
- **`allowed_emails` table** — database-level email authorization
- **`is_allowed_user()` function** — checks authenticated user's email against the allowed list
- **`purchases` table** — with `transaction_date` column (IST)
- **`petty_cash` table** — with `transaction_date` column (IST)
- **`cash_ledger_entries` table** — bulk Markdown import with batch tracking, credit/debit amounts, and source filename
- **Row Level Security policies** — only authorised users can read/write/delete
- **Storage bucket** — creates/updates `factory-photos` as a **private** bucket with storage RLS policies

**First-run setup:** After running the SQL, insert your admin emails:
```sql
INSERT INTO allowed_emails (email) VALUES
  ('kavinrajt@gmail.com'),
  ('brother@gmail.com')
ON CONFLICT (email) DO NOTHING;
```

The script is idempotent — safe to re-run on existing databases. Existing columns are preserved with `IF NOT EXISTS`, and `transaction_date` is backfilled from `created_at` in IST.

### 5. Run the local development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Build & Lint
```bash
npm run build
npm run lint
```

---

## 🚢 Deployment (Vercel)

This application is optimised for 1-click deployment on [Vercel](https://vercel.com/):

1. Import this repository into Vercel.
2. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ALLOWED_EMAILS`
   - `NEXT_PUBLIC_SHARED_AUTH_EMAIL`
3. Click **Deploy**.
4. In Supabase Dashboard → **Authentication → URL Configuration**, add your Vercel URL (e.g. `https://your-app.vercel.app`) to **Redirect URLs**.
5. In Supabase Dashboard → **Authentication → Users**, create or reset the shared auth user for `NEXT_PUBLIC_SHARED_AUTH_EMAIL`. The chosen password becomes the shared access code used on the login screen.

---

## ⚠️ Migration Notes (Existing Deployments)

If upgrading from the previous version:

1. **Run `setup.sql`** — it adds `transaction_date` columns, backfills existing data, and creates the `cash_ledger_entries` table with RLS policies and indexes.
2. **Insert admin emails into `allowed_emails`** — the new RLS policies require this table.
3. **Update storage bucket** — the SQL sets `factory-photos` to private. Existing public URLs will stop working; the app now uses signed URLs automatically.
4. **Photos now return relative paths** — any external integrations using the old public URLs will need updating.
5. **Cash Ledger** — new table `cash_ledger_entries` is created automatically by `setup.sql`. Safe to run on existing databases (all `ALTER TABLE` use `IF NOT EXISTS`).

---

## 📝 Cash Ledger Markdown Format

The Cash Ledger import accepts `.md` files containing a Markdown table. The parser automatically detects columns named Purpose/Expense, Credit Amount, and Debit Amount.

**Accepted column headers (case-insensitive, with or without formatting):**
- Purpose: `Purpose`, `Expense`, `Description`, `Particular`, `Item`
- Credit: `Credit`, `Income`, `Receipt`, `Cash In`
- Debit: `Debit`, `Cash Out`, `Payment`, `Spent`, `Expense Amount`
- Notes (optional): `Note`, `Remark`, `Comment`, `Detail`

**Amount formatting rules:**
- Currency symbols (`₹`, `Rs`, `Rs.`, `INR`, `$`) are automatically stripped
- Thousand commas (`10,000`) are handled
- Trailing `/-` (e.g. `500/-`) is stripped
- Blank, `-`, `—`, or `nil` parsed as `0`
- At least one of Credit or Debit must be > 0 per row

**Sample file:** See [`docs/examples/cash-ledger.md`](./docs/examples/cash-ledger.md)

---

## 📄 License

Internal proprietary software for VKV Factory.
