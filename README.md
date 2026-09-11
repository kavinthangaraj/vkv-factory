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

### 2. Factory Purchases (Chemicals, Firewood, Spare Parts & Electricals)
- **Bill & Chit Verification:** Upload photo of the supplier invoice, manager chit, or WhatsApp confirmation.
- **Purchase Classification:** Track item name, quantity, unit (kg, litre, bundle, drum, etc.), estimated/paid cost, supplier name, and urgency.
- **Approval Tracking:** Mark as *Approved* or *Rejected* (with mandatory rejection reason).
- **Auto-Generated Ref Codes:** Every purchase receives an identifiable reference code (e.g. `REQ-20260911-4821`).

### 3. Factory Owner Dashboard
- Real-time spend overview: Today's and This Month's totals.
- Office-wise breakdown (**VKV vs Gangapuram**).
- Quick actions for single-tap entry on mobile browsers.
- Expandable transaction rows with direct links to full-resolution receipt photos.

### 4. Zero-Friction Authentication
- Email OTP login via Supabase Auth — no OAuth popups, no complex passwords, no Google 2FA issues.
- Whitelist protection: Only configured administrator email IDs can access the system.

---

## 🛠️ Tech Stack

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router, React 18, TypeScript)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security)
- **Storage:** Supabase Storage (Public bucket for factory receipt & notebook photos)
- **Auth:** Supabase Passwordless OTP Authentication

---

## 📁 Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout with AuthProvider
│   ├── page.tsx                # Factory Owner Dashboard
│   ├── login/page.tsx          # Email OTP Sign-in page
│   ├── purchase/
│   │   ├── page.tsx            # Purchase list with status/date filters
│   │   └── new/page.tsx        # Log purchase with bill/chit photo
│   └── petty-cash/
│       ├── page.tsx            # Daily petty cash audit log with date filters
│       └── new/page.tsx        # Daily batch entry & notebook photo mapping
├── components/
│   ├── AuthGuard.tsx           # Route protection for authorised emails
│   ├── AuthProvider.tsx        # Supabase authentication context
│   ├── Navbar.tsx              # Mobile-responsive navigation header
│   └── PhotoUpload.tsx         # Drag & drop / mobile camera image picker
├── lib/
│   ├── constants.ts            # Factory units, units of measure, bilingual purposes
│   ├── firebase.ts             # Supabase client initialisation
│   ├── firestore.ts            # PostgreSQL CRUD & batch transaction handlers
│   └── storage.ts              # Photo upload to Supabase storage bucket
├── setup.sql                   # Database table definitions & RLS policies
└── types/index.ts              # TypeScript interfaces for Purchase and PettyCash
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

### 4. Database Setup
In your Supabase project's **SQL Editor**, paste and run the contents of [`setup.sql`](./setup.sql):
- Creates `purchases` table
- Creates `petty_cash` table
- Enables Row Level Security (RLS)

In your Supabase project's **Storage**:
- Create a bucket named `factory-photos`
- Enable **Public bucket**

### 5. Run the local development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Deployment (Vercel)

This application is optimised for 1-click deployment on [Vercel](https://vercel.com/):

1. Import this repository into Vercel.
2. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_ALLOWED_EMAILS`
3. Click **Deploy**.
4. In Supabase Dashboard → **Authentication → URL Configuration**, add your Vercel URL (e.g. `https://your-app.vercel.app`) to **Redirect URLs**.

---

## 📄 License

Internal proprietary software for VKV Factory.
