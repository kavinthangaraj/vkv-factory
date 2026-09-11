'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import { PhotoUpload } from '@/components/PhotoUpload';
import { addPettyCashBatch, type PettyCashLineItem } from '@/lib/firestore';
import { uploadPhoto } from '@/lib/storage';
import { OFFICES, PETTY_CASH_PURPOSES, getCategoryForPurpose } from '@/lib/constants';
import type { Office } from '@/types';

interface LineItemForm {
  id: string;
  purpose: string;
  amount: string;
  paidTo: string;
  notes: string;
}

const emptyItem = (): LineItemForm => ({
  id: Math.random().toString(36).substring(2, 9),
  purpose: '',
  amount: '',
  paidTo: '',
  notes: '',
});

export default function NewPettyCashPage() {
  const router = useRouter();

  // Date defaults to today's date in YYYY-MM-DD format
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate]       = useState<string>(todayStr);
  const [office, setOffice]   = useState<Office | ''>('VKV');
  const [items, setItems]     = useState<LineItemForm[]>([emptyItem()]);

  const [photo, setPhoto]         = useState<File | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError]         = useState('');

  // Update item field
  const updateItem = (id: string, key: keyof LineItemForm, val: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [key]: val } : it)),
    );
  };

  // Add a new row
  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  // Remove a row
  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Total calculation
  const totalAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { setError('Please select a date.'); return; }
    if (!office) { setError('Please select an office.'); return; }

    // Validate rows
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.purpose) {
        setError(`Row #${i + 1}: Please select a purpose.`);
        return;
      }
      if (!it.amount || Number(it.amount) <= 0) {
        setError(`Row #${i + 1}: Please enter a valid amount.`);
        return;
      }
      if (it.purpose === 'வேறு - Other' && !it.notes.trim()) {
        setError(`Row #${i + 1}: Please describe the expense in Notes for "Other".`);
        return;
      }
    }

    setError('');
    setSaving(true);

    try {
      let photoUrl: string | undefined;

      if (photo) {
        const path = `petty_cash/${date}_${Date.now()}_${photo.name}`;
        photoUrl = await uploadPhoto(photo, path, setUploadPct);
        setUploadPct(null);
      }

      const lineItems: PettyCashLineItem[] = items.map((it) => ({
        purpose: it.purpose,
        amount: Number(it.amount),
        paidTo: it.paidTo.trim(),
        notes: it.notes.trim(),
      }));

      await addPettyCashBatch({
        date,
        office: office as Office,
        photoUrl,
        items: lineItems,
      });

      router.push('/petty-cash');
    } catch (err) {
      console.error(err);
      setError('Failed to save transactions. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Log Daily Petty Cash</h1>
            <p className="text-xs text-gray-500">Upload notebook page / receipts and map the day&apos;s transactions</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Day & Office Settings */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4 border border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">1. Date &amp; Office</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date picker */}
              <div>
                <label className="label">Date of Transactions <span className="text-red-500">*</span></label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input font-medium"
                />
              </div>

              {/* Office selector */}
              <div>
                <label className="label">Office <span className="text-red-500">*</span></label>
                <div className="flex gap-4 mt-2">
                  {OFFICES.map((o) => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="office"
                        value={o}
                        checked={office === o}
                        onChange={() => setOffice(o)}
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-gray-700">{o}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Photo upload: Upload notebook picture for the day */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">
              2. Notebook Picture / Bill Sheet (Optional)
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Upload the photo of today&apos;s handwritten Tamil notebook page or receipts. All entries below will link to this image.
            </p>
            <PhotoUpload
              label="Notebook / Receipt Photo"
              onFileSelect={setPhoto}
            />
            {uploadPct !== null && (
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">{uploadPct}%</p>
              </div>
            )}
          </div>

          {/* Transactions Mapping */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  3. Transactions Mapping ({items.length})
                </h2>
                <p className="text-xs text-gray-500">List each transaction from the day</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">Total:</span>
                <span className="ml-1 text-base font-bold text-green-700">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const isOther = item.purpose === 'வேறு - Other';
                const cat = item.purpose ? getCategoryForPurpose(item.purpose) : null;

                return (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Item #{idx + 1} {cat && <span className="font-normal text-blue-600 ml-1">({cat})</span>}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Purpose dropdown */}
                      <div className="sm:col-span-7">
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          Purpose <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={item.purpose}
                          onChange={(e) => updateItem(item.id, 'purpose', e.target.value)}
                          className="input text-sm"
                        >
                          <option value="">Select purpose…</option>
                          {PETTY_CASH_PURPOSES.map((p) => (
                            <option key={p.label} value={p.label}>{p.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Amount */}
                      <div className="sm:col-span-5">
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                          className="input text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Paid To */}
                      <div>
                        <label className="text-xs text-gray-600 font-medium block mb-1">Paid To (Optional)</label>
                        <input
                          type="text"
                          placeholder="Person / Shop"
                          value={item.paidTo}
                          onChange={(e) => updateItem(item.id, 'paidTo', e.target.value)}
                          className="input text-xs"
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-xs text-gray-600 font-medium block mb-1">
                          Notes {isOther && <span className="text-red-500">* (Required)</span>}
                        </label>
                        <input
                          type="text"
                          required={isOther}
                          placeholder={isOther ? 'Describe other expense' : 'Notes / Tamil detail'}
                          value={item.notes}
                          onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                          className="input text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add row button */}
            <button
              type="button"
              onClick={addItem}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 hover:border-green-500 hover:text-green-700 text-gray-600 font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>+ Add Another Transaction</span>
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium">Total for {date || 'Day'}</p>
              <p className="text-xl font-bold text-green-700">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving Transactions…' : `Save ${items.length} Transaction${items.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </main>

      <style jsx global>{`
        .label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
        .input { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: #111827; background: #fff; outline: none; }
        .input:focus { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
      `}</style>
    </AuthGuard>
  );
}
