import { supabase } from './firebase';
import { getCategoryForPurpose } from './constants';
import { getTodayIST, getMonthStartIST, extractRowDate } from './dateUtils';
import type { Purchase, PettyCash, Office, PurchaseStatus, Urgency, CashLedgerEntry, CashLedgerParsedRow } from '@/types';

// ── ID generators ─────────────────────────────────────────────────────────────
function dateSuffix() {
  return getTodayIST().replace(/-/g, '');
}
function rand4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
export const newRequestId = () => `REQ-${dateSuffix()}-${rand4()}`;
export const newEntryId   = () => `PC-${dateSuffix()}-${rand4()}`;

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function getCurrentUserEmail(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email ?? '';
  } catch {
    return '';
  }
}

// ── Database Row Types ────────────────────────────────────────────────────────
interface PurchaseRow {
  id: string;
  request_id: string;
  created_at: string;
  transaction_date?: string | null;
  requested_by: string;
  item: string;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  supplier?: string | null;
  urgency: Urgency;
  notes?: string | null;
  status: PurchaseStatus;
  rejection_reason?: string | null;
  photo_url?: string | null;
  logged_by?: string | null;
}

interface PettyCashRow {
  id: string;
  entry_id: string;
  created_at: string;
  transaction_date?: string | null;
  office: Office;
  entered_by: string;
  amount: number;
  paid_to?: string | null;
  purpose: string;
  category?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  logged_by?: string | null;
}

// ── Row mappers ───────────────────────────────────────────────────────────────
function toPurchase(r: PurchaseRow): Purchase {
  return {
    id:              r.id,
    requestId:       r.request_id,
    timestamp:       new Date(r.created_at),
    date:            extractRowDate(r),
    requestedBy:     r.requested_by,
    item:            r.item,
    quantity:        r.quantity ?? 0,
    unit:            r.unit ?? 'kg',
    amount:          Number(r.amount) || 0,
    supplier:        r.supplier ?? '',
    urgency:         r.urgency || 'Normal',
    notes:           r.notes ?? '',
    status:          r.status || 'Approved',
    rejectionReason: r.rejection_reason ?? '',
    photoUrl:        r.photo_url ?? undefined,
    loggedBy:        r.logged_by ?? '',
  };
}

function toPettyCash(r: PettyCashRow): PettyCash {
  return {
    id:        r.id,
    entryId:   r.entry_id,
    timestamp: new Date(r.created_at),
    date:      extractRowDate(r),
    office:    r.office,
    enteredBy: r.entered_by ?? '',
    amount:    Number(r.amount) || 0,
    paidTo:    r.paid_to ?? '',
    purpose:   r.purpose,
    category:  r.category ?? 'Other',
    notes:     r.notes ?? '',
    photoUrl:  r.photo_url ?? undefined,
    loggedBy:  r.logged_by ?? '',
  };
}

// ── PURCHASES ─────────────────────────────────────────────────────────────────
export interface NewPurchaseInput {
  date?: string;
  item: string;
  quantity?: number;
  unit?: string;
  amount: number;
  supplier?: string;
  urgency?: Urgency;
  notes?: string;
  status?: PurchaseStatus;
  rejectionReason?: string;
  photoUrl?: string;
  requestedBy?: string;
  loggedBy?: string;
}

export async function addPurchase(data: NewPurchaseInput): Promise<string> {
  const userEmail = data.loggedBy || (await getCurrentUserEmail());
  const dateStr   = data.date || getTodayIST();

  const { data: row, error } = await supabase
    .from('purchases')
    .insert([{
      request_id:       newRequestId(),
      transaction_date: dateStr,
      created_at:       new Date().toISOString(),
      requested_by:     data.requestedBy || userEmail || 'Staff',
      item:             data.item,
      quantity:         data.quantity ?? 0,
      unit:             data.unit ?? 'kg',
      amount:           data.amount,
      supplier:         data.supplier ?? '',
      urgency:          data.urgency ?? 'Normal',
      notes:            data.notes ?? '',
      status:           data.status ?? 'Approved',
      rejection_reason: data.rejectionReason ?? null,
      photo_url:        data.photoUrl ?? null,
      logged_by:        userEmail,
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return row.id;
}

export async function updatePurchase(
  id: string,
  data: Partial<NewPurchaseInput>,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (data.item !== undefined)            updates.item = data.item;
  if (data.amount !== undefined)          updates.amount = data.amount;
  if (data.quantity !== undefined)        updates.quantity = data.quantity;
  if (data.unit !== undefined)            updates.unit = data.unit;
  if (data.supplier !== undefined)        updates.supplier = data.supplier;
  if (data.urgency !== undefined)         updates.urgency = data.urgency;
  if (data.notes !== undefined)           updates.notes = data.notes;
  if (data.status !== undefined)          updates.status = data.status;
  if (data.rejectionReason !== undefined) updates.rejection_reason = data.rejectionReason;
  if (data.photoUrl !== undefined)        updates.photo_url = data.photoUrl;
  if (data.date !== undefined)            updates.transaction_date = data.date;
  if (data.requestedBy !== undefined)     updates.requested_by = data.requestedBy;

  const { error } = await supabase
    .from('purchases')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getPurchases(filters?: {
  status?: string;
  date?: string;
  from?: Date;
  to?: Date;
}): Promise<Purchase[]> {
  let q = supabase
    .from('purchases')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) q = q.eq('status', filters.status);

  if (filters?.date) {
    // Check transaction_date match or created_at match
    q = q.or(`transaction_date.eq.${filters.date},and(transaction_date.is.null,created_at.gte.${filters.date}T00:00:00+05:30,created_at.lte.${filters.date}T23:59:59+05:30)`);
  }
  if (filters?.from) q = q.gte('created_at', filters.from.toISOString());
  if (filters?.to)   q = q.lte('created_at', filters.to.toISOString());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toPurchase(r as PurchaseRow));
}

export async function deletePurchase(id: string): Promise<void> {
  const { error } = await supabase.from('purchases').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── PETTY CASH ────────────────────────────────────────────────────────────────
export interface PettyCashLineItem {
  purpose: string;
  amount: number;
  paidTo?: string;
  notes?: string;
  category?: string;
}

export interface NewPettyCashBatchParams {
  date: string;
  office: Office;
  photoUrl?: string;
  items: PettyCashLineItem[];
  enteredBy?: string;
  loggedBy?: string;
}

export async function addPettyCashBatch(params: NewPettyCashBatchParams): Promise<void> {
  const { date, office, photoUrl, items } = params;
  const userEmail = params.loggedBy || (await getCurrentUserEmail());
  const enteredBy = params.enteredBy || userEmail || 'Staff';

  const rows = items.map((item) => ({
    entry_id:         newEntryId(),
    created_at:       new Date().toISOString(),
    transaction_date: date,
    office,
    entered_by:       enteredBy,
    amount:           item.amount,
    paid_to:          item.paidTo ?? '',
    purpose:          item.purpose,
    category:         item.category || getCategoryForPurpose(item.purpose),
    notes:            item.notes ?? '',
    photo_url:        photoUrl ?? null,
    logged_by:        userEmail,
  }));

  const { error } = await supabase.from('petty_cash').insert(rows);
  if (error) throw new Error(error.message);
}

export async function addPettyCash(
  data: Omit<PettyCash, 'id' | 'entryId' | 'timestamp'> & { date?: string },
): Promise<string> {
  const dateStr = data.date || getTodayIST();
  await addPettyCashBatch({
    date: dateStr,
    office: data.office,
    photoUrl: data.photoUrl,
    enteredBy: data.enteredBy,
    loggedBy: data.loggedBy,
    items: [{
      purpose:  data.purpose,
      amount:   data.amount,
      paidTo:   data.paidTo,
      notes:    data.notes,
      category: data.category,
    }],
  });
  return 'ok';
}

export interface UpdatePettyCashInput {
  date?: string;
  office?: Office;
  purpose?: string;
  category?: string;
  amount?: number;
  paidTo?: string;
  notes?: string;
  photoUrl?: string;
}

export async function updatePettyCash(
  id: string,
  data: UpdatePettyCashInput,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (data.date !== undefined)     updates.transaction_date = data.date;
  if (data.office !== undefined)   updates.office = data.office;
  if (data.amount !== undefined)   updates.amount = data.amount;
  if (data.paidTo !== undefined)   updates.paid_to = data.paidTo;
  if (data.notes !== undefined)    updates.notes = data.notes;
  if (data.photoUrl !== undefined) updates.photo_url = data.photoUrl;

  if (data.purpose !== undefined) {
    updates.purpose = data.purpose;
    // Update category automatically if not explicitly given
    updates.category = data.category || getCategoryForPurpose(data.purpose);
  } else if (data.category !== undefined) {
    updates.category = data.category;
  }

  const { error } = await supabase
    .from('petty_cash')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function getPettyCash(filters?: {
  office?: string;
  date?: string;
  category?: string;
  from?: Date;
  to?: Date;
}): Promise<PettyCash[]> {
  let q = supabase
    .from('petty_cash')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.office)   q = q.eq('office', filters.office);
  if (filters?.category) q = q.eq('category', filters.category);

  if (filters?.date) {
    // Match explicit transaction_date or fallback to created_at
    q = q.or(`transaction_date.eq.${filters.date},and(transaction_date.is.null,created_at.gte.${filters.date}T00:00:00+05:30,created_at.lte.${filters.date}T23:59:59+05:30)`);
  }
  if (filters?.from)     q = q.gte('created_at', filters.from.toISOString());
  if (filters?.to)       q = q.lte('created_at', filters.to.toISOString());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toPettyCash(r as PettyCashRow));
}

export async function deletePettyCash(id: string): Promise<void> {
  const { error } = await supabase.from('petty_cash').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── CASH LEDGER ──────────────────────────────────────────────────────────────
interface CashLedgerRow {
  id: string;
  batch_id: string;
  created_at: string;
  transaction_date?: string | null;
  office: Office;
  purpose: string;
  credit_amount: number;
  debit_amount: number;
  notes?: string | null;
  source_filename?: string | null;
  logged_by?: string | null;
}

function toCashLedgerEntry(r: CashLedgerRow): CashLedgerEntry {
  return {
    id:              r.id,
    batchId:         r.batch_id,
    date:            extractRowDate(r),
    transactionDate: r.transaction_date?.slice(0, 10),
    office:          r.office as Office,
    purpose:         r.purpose,
    creditAmount:    Number(r.credit_amount) || 0,
    debitAmount:     Number(r.debit_amount) || 0,
    notes:           r.notes ?? '',
    sourceFilename:  r.source_filename ?? '',
    loggedBy:        r.logged_by ?? '',
    createdAt:       r.created_at ? new Date(r.created_at) : undefined,
  };
}

export interface NewCashLedgerBatchParams {
  date: string;
  office: Office;
  sourceFilename?: string;
  rows: CashLedgerParsedRow[];
  batchId?: string;
}

export async function addCashLedgerBatch(params: NewCashLedgerBatchParams): Promise<string> {
  const { date, office, sourceFilename, rows } = params;
  const userEmail = await getCurrentUserEmail();
  const batchId = params.batchId || `CL-${date.replace(/-/g, '')}-${Date.now()}`;

  if (!rows.length) {
    throw new Error('No valid rows to save. Please review the parsed entries before saving.');
  }

  for (const row of rows) {
    if (row.creditAmount < 0 || row.debitAmount < 0) {
      throw new Error(`Invalid amount for "${row.purpose}": credit and debit must be non-negative.`);
    }
    if (row.creditAmount === 0 && row.debitAmount === 0) {
      throw new Error(`Row "${row.purpose}" must have either credit or debit greater than 0.`);
    }
  }

  const dbRows = rows.map((row) => ({
    batch_id:         batchId,
    created_at:       new Date().toISOString(),
    transaction_date: date,
    office,
    purpose:          row.purpose,
    credit_amount:    row.creditAmount,
    debit_amount:     row.debitAmount,
    notes:            row.notes ?? '',
    source_filename:  sourceFilename ?? null,
    logged_by:        userEmail,
  }));

  const { error } = await supabase.from('cash_ledger_entries').insert(dbRows);
  if (error) throw new Error(error.message);
  return batchId;
}

export async function getCashLedgerEntries(filters?: {
  date?: string;
  office?: Office;
  batchId?: string;
}): Promise<CashLedgerEntry[]> {
  let q = supabase
    .from('cash_ledger_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.office)   q = q.eq('office', filters.office);
  if (filters?.batchId)  q = q.eq('batch_id', filters.batchId);

  if (filters?.date) {
    q = q.or(`transaction_date.eq.${filters.date},and(transaction_date.is.null,created_at.gte.${filters.date}T00:00:00+05:30,created_at.lte.${filters.date}T23:59:59+05:30)`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toCashLedgerEntry(r as CashLedgerRow));
}

export interface UpdateCashLedgerInput {
  date?: string;
  office?: Office;
  purpose?: string;
  creditAmount?: number;
  debitAmount?: number;
  notes?: string;
}

export async function updateCashLedgerEntry(
  id: string,
  data: UpdateCashLedgerInput,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (data.date !== undefined)        updates.transaction_date = data.date;
  if (data.office !== undefined)      updates.office = data.office;
  if (data.purpose !== undefined)     updates.purpose = data.purpose;
  if (data.creditAmount !== undefined) updates.credit_amount = data.creditAmount;
  if (data.debitAmount !== undefined)  updates.debit_amount = data.debitAmount;
  if (data.notes !== undefined)        updates.notes = data.notes;

  const { error } = await supabase
    .from('cash_ledger_entries')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteCashLedgerEntry(id: string): Promise<void> {
  const { error } = await supabase.from('cash_ledger_entries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const todayIST      = getTodayIST();
  const monthStartIST = getMonthStartIST(todayIST);

  const [purchases, petty] = await Promise.all([getPurchases(), getPettyCash()]);

  const pettyToday = petty.filter((e) => e.date === todayIST);
  const pettyMonth = petty.filter((e) => e.date >= monthStartIST);

  return {
    todayIST,
    purchasesToday:           purchases.filter((p) => p.date === todayIST).length,
    purchasesThisMonth:       purchases.filter((p) => p.date >= monthStartIST).length,
    pettyTotalToday:          pettyToday.reduce((s, e) => s + e.amount, 0),
    pettyTotalThisMonth:      pettyMonth.reduce((s, e) => s + e.amount, 0),
    pettyVKVThisMonth:        pettyMonth.filter((e) => e.office === 'VKV').reduce((s, e) => s + e.amount, 0),
    pettyGangapuramThisMonth: pettyMonth.filter((e) => e.office === 'Gangapuram').reduce((s, e) => s + e.amount, 0),
    recentPurchases:          purchases.slice(0, 5),
    recentPettyCash:          petty.slice(0, 5),
  };
}
