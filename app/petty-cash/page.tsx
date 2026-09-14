'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import { SecurePhoto } from '@/components/SecurePhoto';
import { PhotoUpload } from '@/components/PhotoUpload';
import { getPettyCash, updatePettyCash, deletePettyCash } from '@/lib/firestore';
import { uploadPhoto } from '@/lib/storage';
import { OFFICES, CATEGORIES, PETTY_CASH_PURPOSES, getCategoryForPurpose } from '@/lib/constants';
import { formatDateIST, getTodayIST } from '@/lib/dateUtils';
import type { PettyCash, Office } from '@/types';

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

const CATEGORY_COLORS: Record<string, string> = {
  Fuel:        'bg-orange-100 text-orange-700',
  Transport:   'bg-sky-100 text-sky-700',
  Utilities:   'bg-cyan-100 text-cyan-700',
  Welfare:     'bg-pink-100 text-pink-700',
  Labour:      'bg-yellow-100 text-yellow-700',
  Maintenance: 'bg-slate-100 text-slate-700',
  Admin:       'bg-indigo-100 text-indigo-700',
  Other:       'bg-gray-100 text-gray-600',
};

export default function PettyCashListPage() {
  const [rows, setRows]                       = useState<PettyCash[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [loadError, setLoadError]             = useState<string | null>(null);
  const [filterOffice, setFilterOffice]       = useState('');
  const [filterCategory, setFilterCategory]   = useState('');
  const [filterDate, setFilterDate]           = useState('');
  const [expanded, setExpanded]               = useState<string | null>(null);
  const [deleting, setDeleting]               = useState<string | null>(null);
  const [actionError, setActionError]         = useState<string | null>(null);

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<PettyCash | null>(null);
  const [editForm, setEditForm]         = useState<{
    date: string;
    office: Office;
    purpose: string;
    amount: string;
    paidTo: string;
    notes: string;
  } | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPettyCash({
        office:   filterOffice   || undefined,
        category: filterCategory || undefined,
        date:     filterDate     || undefined,
      });
      setRows(data);
    } catch (err: unknown) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load petty cash records.');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterCategory, filterDate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this petty cash entry?')) return;
    setDeleting(id);
    setActionError(null);
    try {
      await deletePettyCash(id);
      setRows((r) => r.filter((x) => x.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Failed to delete entry.');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (e: PettyCash) => {
    setEditingEntry(e);
    setEditForm({
      date:   e.date || getTodayIST(),
      office: e.office,
      purpose: e.purpose,
      amount: String(e.amount),
      paidTo: e.paidTo || '',
      notes:  e.notes || '',
    });
    setNewPhotoFile(null);
    setEditError(null);
  };

  const handleSaveEdit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!editingEntry || !editForm) return;

    if (!editForm.purpose) { setEditError('Please select a purpose.'); return; }
    if (!editForm.amount || Number(editForm.amount) <= 0) { setEditError('Please enter a valid amount.'); return; }

    setEditSaving(true);
    setEditError(null);

    try {
      let photoUrl = editingEntry.photoUrl;

      if (newPhotoFile) {
        const path = `petty_cash/${editForm.date}_${Date.now()}_${newPhotoFile.name}`;
        photoUrl = await uploadPhoto(newPhotoFile, path);
      }

      await updatePettyCash(editingEntry.id!, {
        date:    editForm.date,
        office:  editForm.office,
        purpose: editForm.purpose,
        amount:  Number(editForm.amount),
        paidTo:  editForm.paidTo.trim(),
        notes:   editForm.notes.trim(),
        photoUrl,
      });

      // Update in local state
      setRows((prev) =>
        prev.map((item) =>
          item.id === editingEntry.id
            ? {
                ...item,
                date:    editForm.date,
                office:  editForm.office,
                purpose: editForm.purpose,
                category: getCategoryForPurpose(editForm.purpose),
                amount:  Number(editForm.amount),
                paidTo:  editForm.paidTo.trim(),
                notes:   editForm.notes.trim(),
                photoUrl,
              }
            : item,
        ),
      );

      setEditingEntry(null);
      setEditForm(null);
    } catch (err: unknown) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : 'Failed to update entry.');
    } finally {
      setEditSaving(false);
    }
  };

  // Summary calculations
  const total     = rows.reduce((s, r) => s + r.amount, 0);
  const vkvTotal  = rows.filter((r) => r.office === 'VKV').reduce((s, r) => s + r.amount, 0);
  const gangTotal = rows.filter((r) => r.office === 'Gangapuram').reduce((s, r) => s + r.amount, 0);

  // Category breakdown (shown when date filter is active)
  const categoryTotals = filterDate
    ? CATEGORIES
        .map((cat) => ({
          category: cat,
          total: rows.filter((r) => r.category === cat).reduce((s, r) => s + r.amount, 0),
          count: rows.filter((r) => r.category === cat).length,
        }))
        .filter((c) => c.total > 0)
    : [];

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Petty Cash Log</h1>
            <p className="text-xs text-gray-500">Track daily notebook transactions by date &amp; office</p>
          </div>
          <Link
            href="/petty-cash/new"
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Log Daily Entries
          </Link>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-500 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            title="Filter by Date"
          />

          <select
            value={filterOffice}
            onChange={(e) => setFilterOffice(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Offices</option>
            {OFFICES.map((o) => <option key={o}>{o}</option>)}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>

          {(filterOffice || filterCategory || filterDate) && (
            <button
              onClick={() => { setFilterOffice(''); setFilterCategory(''); setFilterDate(''); }}
              className="text-sm text-red-500 hover:underline px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Loading / Error / Empty States */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-500 text-sm">Loading transactions…</p>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center my-6">
            <p className="text-red-700 font-semibold mb-1">Failed to load petty cash records</p>
            <p className="text-gray-600 text-xs mb-4">{loadError}</p>
            <button
              onClick={load}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            {rows.length > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4 grid grid-cols-3 gap-2 text-sm text-center">
                <div>
                  <p className="text-gray-500 text-xs">Total ({rows.length})</p>
                  <p className="font-bold text-green-700">{inr(total)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">VKV</p>
                  <p className="font-bold text-orange-600">{inr(vkvTotal)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Gangapuram</p>
                  <p className="font-bold text-purple-600">{inr(gangTotal)}</p>
                </div>
              </div>
            )}

            {/* Daily category breakdown (shown when date filter is active) */}
            {filterDate && categoryTotals.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  📊 Category Breakdown — {formatDateIST(filterDate)}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categoryTotals.map((c) => (
                    <div key={c.category} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          CATEGORY_COLORS[c.category] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.category}
                      </span>
                      <div className="text-right ml-2">
                        <span className="text-sm font-bold text-gray-800">{inr(c.total)}</span>
                        <span className="text-xs text-gray-400 ml-1">({c.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">💰</p>
                <p className="text-gray-500">No petty cash entries found for this filter.</p>
                <Link href="/petty-cash/new" className="text-green-600 text-sm hover:underline mt-2 inline-block">
                  Log daily transactions →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((e) => (
                  <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setExpanded(expanded === e.id ? null : e.id!)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          CATEGORY_COLORS[e.category] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {e.category}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.purpose}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-medium text-blue-700">{e.office}</span> · 📅 {formatDateIST(e.date)}
                          {e.paidTo && ` · Paid to: ${e.paidTo}`}
                          {e.photoUrl && <span className="ml-1 text-green-600 font-medium">📷 Photo</span>}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-800">{inr(e.amount)}</p>
                      </div>
                      <span className="text-gray-400 text-xs ml-1">{expanded === e.id ? '▲' : '▼'}</span>
                    </button>

                    {expanded === e.id && (
                      <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-400">Date:</span> <span className="font-medium">{formatDateIST(e.date)}</span></div>
                          <div><span className="text-gray-400">Office:</span> <span className="font-medium">{e.office}</span></div>
                          <div><span className="text-gray-400">Paid To:</span> {e.paidTo || '—'}</div>
                          <div><span className="text-gray-400">Entry Ref:</span> <span className="font-mono text-xs text-gray-500">{e.entryId}</span></div>
                          {e.enteredBy && <div><span className="text-gray-400">Entered by:</span> {e.enteredBy}</div>}
                          {e.loggedBy && <div className="text-xs text-gray-500"><span className="text-gray-400">Logged by:</span> {e.loggedBy}</div>}
                          {e.notes && (
                            <div className="col-span-2"><span className="text-gray-400">Notes:</span> {e.notes}</div>
                          )}
                        </div>

                        {/* Photo with authenticated signed URL */}
                        {e.photoUrl && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1 font-medium">Notebook / Bill Photo:</p>
                            <SecurePhoto
                              src={e.photoUrl}
                              alt={`Notebook page for ${e.purpose}`}
                            />
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => startEdit(e)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            ✎ Edit entry
                          </button>
                          <button
                            onClick={() => handleDelete(e.id!)}
                            disabled={deleting === e.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deleting === e.id ? 'Deleting…' : 'Delete entry'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Edit Modal */}
        {editingEntry && editForm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-lg">Edit Petty Cash Entry</h3>
                <button
                  onClick={() => { setEditingEntry(null); setEditForm(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              {editError && (
                <div className="bg-red-50 text-red-700 border border-red-200 text-xs rounded-lg p-3">
                  {editError}
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date (IST)</label>
                    <input
                      type="date"
                      required
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Office</label>
                    <div className="flex gap-4 mt-2">
                      {OFFICES.map((o) => (
                        <label key={o} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="editOffice"
                            value={o}
                            checked={editForm.office === o}
                            onChange={() => setEditForm({ ...editForm, office: o })}
                            className="accent-green-600"
                          />
                          <span className="text-sm font-medium text-gray-700">{o}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose</label>
                  <select
                    required
                    value={editForm.purpose}
                    onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select purpose…</option>
                    {PETTY_CASH_PURPOSES.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Paid To</label>
                  <input
                    type="text"
                    value={editForm.paidTo}
                    onChange={(e) => setEditForm({ ...editForm, paidTo: e.target.value })}
                    placeholder="Person / Shop"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>

                {/* Photo Update */}
                <div className="border-t pt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Notebook Photo (Optional)</label>
                  {editingEntry.photoUrl && !newPhotoFile && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Current photo:</p>
                      <SecurePhoto src={editingEntry.photoUrl} thumbnailClassName="h-28 object-contain rounded border" />
                    </div>
                  )}
                  <PhotoUpload
                    label={editingEntry.photoUrl ? 'Replace Photo' : 'Upload Notebook Photo'}
                    onFileSelect={setNewPhotoFile}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { setEditingEntry(null); setEditForm(null); }}
                    className="px-4 py-2 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
