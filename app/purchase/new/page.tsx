'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import { PhotoUpload } from '@/components/PhotoUpload';
import { addPurchase } from '@/lib/firestore';
import { uploadPhoto } from '@/lib/storage';
import { UNITS, URGENCY_OPTIONS, STATUS_OPTIONS } from '@/lib/constants';
import type { PurchaseStatus, Urgency } from '@/types';

interface FormState {
  date: string;
  item: string;
  quantity: string;
  unit: string;
  amount: string;
  supplier: string;
  urgency: Urgency;
  notes: string;
  status: PurchaseStatus;
  rejectionReason: string;
}

export default function NewPurchasePage() {
  const router = useRouter();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormState>({
    date: todayStr,
    item: '',
    quantity: '',
    unit: 'kg',
    amount: '',
    supplier: '',
    urgency: 'Normal',
    notes: '',
    status: 'Approved',
    rejectionReason: '',
  });

  const [photo, setPhoto]         = useState<File | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError]         = useState('');

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { setError('Please select a date.'); return; }
    if (!form.item.trim()) { setError('Please enter the item name.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('Please enter a valid amount.'); return; }

    setError('');
    setSaving(true);

    try {
      let photoUrl: string | undefined;

      if (photo) {
        const path = `purchases/${form.date}_${Date.now()}_${photo.name}`;
        photoUrl = await uploadPhoto(photo, path, setUploadPct);
        setUploadPct(null);
      }

      await addPurchase({
        date:            form.date,
        item:            form.item.trim(),
        quantity:        Number(form.quantity) || 0,
        unit:            form.unit,
        amount:          Number(form.amount),
        supplier:        form.supplier.trim(),
        urgency:         form.urgency,
        notes:           form.notes.trim(),
        status:          form.status,
        rejectionReason: form.status === 'Rejected' ? form.rejectionReason.trim() : undefined,
        photoUrl,
      });

      router.push('/purchase');
    } catch (err) {
      console.error(err);
      setError('Failed to save purchase. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Log Purchase</h1>
            <p className="text-xs text-gray-500">Add purchase with bill photo or chit</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Photo upload */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <PhotoUpload
              label="Purchase Chit / Bill / WhatsApp Photo"
              onFileSelect={setPhoto}
            />
            {uploadPct !== null && (
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">{uploadPct}%</p>
              </div>
            )}
          </div>

          {/* Core details */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4 border border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Purchase Details</h2>

            {/* Date */}
            <div>
              <label className="label">Date of Purchase <span className="text-red-500">*</span></label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="input font-medium"
              />
            </div>

            {/* Item */}
            <div>
              <label className="label">Item / Material <span className="text-red-500">*</span></label>
              <input
                required
                type="text"
                placeholder="e.g. Caustic Soda / Firewood / Bearings"
                value={form.item}
                onChange={(e) => set('item', e.target.value)}
                className="input"
              />
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Unit</label>
                <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="input">
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="label">Amount (₹) <span className="text-red-500">*</span></label>
              <input
                required
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                className="input font-semibold"
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="label">Supplier / Shop Name</label>
              <input
                type="text"
                placeholder="Supplier name"
                value={form.supplier}
                onChange={(e) => set('supplier', e.target.value)}
                className="input"
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="label">Urgency</label>
              <div className="flex gap-4">
                {URGENCY_OPTIONS.map((u) => (
                  <label key={u} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="urgency"
                      value={u}
                      checked={form.urgency === u}
                      onChange={() => set('urgency', u)}
                      className="accent-blue-600 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">{u}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes / Description (Tamil / English)</label>
              <textarea
                rows={2}
                placeholder="Any additional details or Tamil notes…"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="input resize-none"
              />
            </div>
          </div>

          {/* Decision */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4 border border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Status</h2>

            <div className="flex gap-4">
              {STATUS_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={form.status === s}
                    onChange={() => set('status', s)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span
                    className={`text-sm font-semibold ${
                      s === 'Approved' ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {s}
                  </span>
                </label>
              ))}
            </div>

            {form.status === 'Rejected' && (
              <div>
                <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={2}
                  placeholder="Why was this rejected?"
                  value={form.rejectionReason}
                  onChange={(e) => set('rejectionReason', e.target.value)}
                  className="input resize-none"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving Purchase…' : 'Save Purchase Record'}
          </button>
        </form>
      </main>

      <style jsx global>{`
        .label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
        .input { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #111827; background: #fff; outline: none; }
        .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      `}</style>
    </AuthGuard>
  );
}
