import { supabase } from './firebase';
import type { Purchase, PettyCash } from '@/types';

// ── ID generators ─────────────────────────────────────────────────────────────
function dateSuffix() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
function rand4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
export const newRequestId = () => `REQ-${dateSuffix()}-${rand4()}`;
export const newEntryId   = () => `PC-${dateSuffix()}-${rand4()}`;

// ── Row mappers ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPurchase(r: any): Purchase {
  return {
    id:              r.id,
    requestId:       r.request_id,
    timestamp:       new Date(r.created_at),
    requestedBy:     r.requested_by,
    item:            r.item,
    quantity:        r.quantity,
    unit:            r.unit,
    amount:          r.amount,
    supplier:        r.supplier ?? '',
    urgency:         r.urgency,
    notes:           r.notes ?? '',
    status:          r.status,
    rejectionReason: r.rejection_reason ?? '',
    photoUrl:        r.photo_url ?? undefined,
    loggedBy:        r.logged_by ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPettyCash(r: any): PettyCash {
  return {
    id:        r.id,
    entryId:   r.entry_id,
    timestamp: new Date(r.created_at),
    office:    r.office,
    enteredBy: r.entered_by,
    amount:    r.amount,
    paidTo:    r.paid_to ?? '',
    purpose:   r.purpose,
    category:  r.category ?? '',
    notes:     r.notes ?? '',
    photoUrl:  r.photo_url ?? undefined,
    loggedBy:  r.logged_by ?? '',
  };
}

// ── PURCHASES ─────────────────────────────────────────────────────────────────
type NewPurchase = Omit<Purchase, 'id' | 'requestId' | 'timestamp'> & { date?: string };

export async function addPurchase(data: NewPurchase): Promise<string> {
  const createdAt = data.date
    ? new Date(`${data.date}T12:00:00.000Z`).toISOString()
    : new Date().toISOString();

  const { data: row, error } = await supabase
    .from('purchases')
    .insert([{
      request_id:       newRequestId(),
      created_at:       createdAt,
      requested_by:     data.requestedBy ?? '',
      item:             data.item,
      quantity:         data.quantity,
      unit:             data.unit,
      amount:           data.amount,
      supplier:         data.supplier,
      urgency:          data.urgency,
      notes:            data.notes,
      status:           data.status,
      rejection_reason: data.rejectionReason ?? null,
      photo_url:        data.photoUrl ?? null,
      logged_by:        data.loggedBy ?? '',
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return row.id;
}

export async function getPurchases(filters?: {
  status?: string;
  date?: string;
  from?: Date;
  to?: Date;
}): Promise<Purchase[]> {
  let q = supabase.from('purchases').select('*').order('created_at', { ascending: false });

  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.date) {
    const start = `${filters.date}T00:00:00.000Z`;
    const end = `${filters.date}T23:59:59.999Z`;
    q = q.gte('created_at', start).lte('created_at', end);
  }
  if (filters?.from) q = q.gte('created_at', filters.from.toISOString());
  if (filters?.to)   q = q.lte('created_at', filters.to.toISOString());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPurchase);
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
}

export async function addPettyCashBatch(params: {
  date: string;
  office: 'VKV' | 'Gangapuram';
  photoUrl?: string;
  items: PettyCashLineItem[];
}): Promise<void> {
  const { date, office, photoUrl, items } = params;
  const createdAt = new Date(`${date}T12:00:00.000Z`).toISOString();

  const rows = items.map((item) => ({
    entry_id:   newEntryId(),
    created_at: createdAt,
    office,
    entered_by: '',
    amount:     item.amount,
    paid_to:    item.paidTo ?? '',
    purpose:    item.purpose,
    category:   item.notes?.includes('Category:') ? '' : undefined, // let auto-category handle or leave column
    notes:      item.notes ?? '',
    photo_url:  photoUrl ?? null,
    logged_by:  '',
  }));

  // Import getCategoryForPurpose inline to keep categories accurate
  const { getCategoryForPurpose } = await import('./constants');
  rows.forEach((r) => {
    r.category = getCategoryForPurpose(r.purpose);
  });

  const { error } = await supabase.from('petty_cash').insert(rows);
  if (error) throw new Error(error.message);
}

export async function addPettyCash(data: Omit<PettyCash, 'id' | 'entryId' | 'timestamp'> & { date?: string }): Promise<string> {
  const dateStr = data.date || new Date().toISOString().slice(0, 10);
  await addPettyCashBatch({
    date: dateStr,
    office: data.office,
    photoUrl: data.photoUrl,
    items: [{
      purpose: data.purpose,
      amount: data.amount,
      paidTo: data.paidTo,
      notes: data.notes,
    }],
  });
  return 'ok';
}

export async function getPettyCash(filters?: {
  office?: string;
  date?: string;
  category?: string;
  from?: Date;
  to?: Date;
}): Promise<PettyCash[]> {
  let q = supabase.from('petty_cash').select('*').order('created_at', { ascending: false });

  if (filters?.office)   q = q.eq('office', filters.office);
  if (filters?.category) q = q.eq('category', filters.category);
  if (filters?.date) {
    const start = `${filters.date}T00:00:00.000Z`;
    const end = `${filters.date}T23:59:59.999Z`;
    q = q.gte('created_at', start).lte('created_at', end);
  }
  if (filters?.from)     q = q.gte('created_at', filters.from.toISOString());
  if (filters?.to)       q = q.lte('created_at', filters.to.toISOString());

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPettyCash);
}

export async function deletePettyCash(id: string): Promise<void> {
  const { error } = await supabase.from('petty_cash').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [purchases, petty] = await Promise.all([getPurchases(), getPettyCash()]);

  const pettyToday = petty.filter((e) => e.timestamp >= today);
  const pettyMonth = petty.filter((e) => e.timestamp >= monthStart);

  return {
    purchasesToday:           purchases.filter((p) => p.timestamp >= today).length,
    purchasesThisMonth:       purchases.filter((p) => p.timestamp >= monthStart).length,
    pettyTotalToday:          pettyToday.reduce((s, e) => s + e.amount, 0),
    pettyTotalThisMonth:      pettyMonth.reduce((s, e) => s + e.amount, 0),
    pettyVKVThisMonth:        pettyMonth.filter((e) => e.office === 'VKV').reduce((s, e) => s + e.amount, 0),
    pettyGangapuramThisMonth: pettyMonth.filter((e) => e.office === 'Gangapuram').reduce((s, e) => s + e.amount, 0),
    recentPurchases:          purchases.slice(0, 5),
    recentPettyCash:          petty.slice(0, 5),
  };
}
