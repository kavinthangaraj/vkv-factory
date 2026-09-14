'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import { SecurePhoto } from '@/components/SecurePhoto';
import { PhotoUpload } from '@/components/PhotoUpload';
import { getPurchases, updatePurchase, deletePurchase } from '@/lib/firestore';
import { uploadPhoto } from '@/lib/storage';
import { STATUS_OPTIONS, UNITS, URGENCY_OPTIONS } from '@/lib/constants';
import { formatDateIST, getTodayIST } from '@/lib/dateUtils';
import type { Purchase, PurchaseStatus, Urgency } from '@/types';

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export default function PurchaseListPage() {
  const [rows, setRows]                 = useState<Purchase[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate]     = useState('');
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [actionError, setActionError]   = useState<string | null>(null);

  // Edit modal state
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editForm, setEditForm]               = useState<{
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
  } | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPurchases({
        status: filterStatus || undefined,
        date:   filterDate   || undefined,
      });
      setRows(data);
    } catch (err: unknown) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load purchase records.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase record?')) return;
    setDeleting(id);
    setActionError(null);
    try {
      await deletePurchase(id);
      setRows((r) => r.filter((x) => x.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : 'Failed to delete record. Please check database permissions.');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (p: Purchase) => {
    setEditingPurchase(p);
    setEditForm({
      date:            p.date || getTodayIST(),
      item:            p.item,
      quantity:        p.quantity ? String(p.quantity) : '',
      unit:            p.unit || 'kg',
      amount:          String(p.amount),
      supplier:        p.supplier || '',
      urgency:         p.urgency || 'Normal',
      notes:           p.notes || '',
      status:          p.status || 'Approved',
      rejectionReason: p.rejectionReason || '',
    });
    setNewPhotoFile(null);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase || !editForm) return;

    if (!editForm.item.trim()) { setEditError('Item name is required.'); return; }
    if (!editForm.amount || Number(editForm.amount) <= 0) { setEditError('Valid amount is required.'); return; }

    setEditSaving(true);
    setEditError(null);

    try {
      let photoUrl = editingPurchase.photoUrl;

      if (newPhotoFile) {
        const path = `purchases/${editForm.date}_${Date.now()}_${newPhotoFile.name}`;
        photoUrl = await uploadPhoto(newPhotoFile, path);
      }

      await updatePurchase(editingPurchase.id!, {
        date:            editForm.date,
        item:            editForm.item.trim(),
        quantity:        Number(editForm.quantity) || 0,
        unit:            editForm.unit,
        amount:          Number(editForm.amount),
        supplier:        editForm.supplier.trim(),
        urgency:         editForm.urgency,
        notes:           editForm.notes.trim(),
        status:          editForm.status,
        rejectionReason: editForm.status === 'Rejected' ? editForm.rejectionReason.trim() : '',
        photoUrl,
      });

      // Update in local state
      setRows((prev) =>
        prev.map((item) =>
          item.id === editingPurchase.id
            ? {
                ...item,
                date:            editForm.date,
                item:            editForm.item.trim(),
                quantity:        Number(editForm.quantity) || 0,
                unit:            editForm.unit,
                amount:          Number(editForm.amount),
                supplier:        editForm.supplier.trim(),
                urgency:         editForm.urgency,
                notes:           editForm.notes.trim(),
                status:          editForm.status,
                rejectionReason: editForm.status === 'Rejected' ? editForm.rejectionReason.trim() : '',
                photoUrl,
              }
            : item,
        ),
      );

      setEditingPurchase(null);
      setEditForm(null);
    } catch (err: unknown) {
      console.error(err);
      setEditError(err instanceof Error ? err.message : 'Failed to update purchase record.');
    } finally {
      setEditSaving(false);
    }
  };

  const totalApproved = rows
    .filter((r) => r.status === 'Approved')
    .reduce((s, r) => s + r.amount, 0);

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Purchases Log</h1>
            <p className="text-xs text-gray-500">Chemicals, firewood, spare parts &amp; components</p>
          </div>
          <Link
            href="/purchase/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            + Log Purchase
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>

          {(filterStatus || filterDate) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterDate(''); }}
              className="text-sm text-red-500 hover:underline px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Summary bar */}
        {!loading && !loadError && rows.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between text-sm">
            <span className="text-gray-600">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
            <span className="font-semibold text-blue-700">Approved total: {inr(totalApproved)}</span>
          </div>
        )}

        {/* Loading / Error / Empty States */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-500 text-sm">Loading purchase records…</p>
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center my-6">
            <p className="text-red-700 font-semibold mb-1">Failed to load purchases</p>
            <p className="text-gray-600 text-xs mb-4">{loadError}</p>
            <button
              onClick={load}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500">No purchase records found.</p>
            <Link href="/purchase/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              Log the first one →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Row summary */}
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id!)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      p.status === 'Approved' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.item}</p>
                    <p className="text-xs text-gray-500">
                      📅 {formatDateIST(p.date)} {p.supplier ? `· ${p.supplier}` : ''}
                      {p.photoUrl && <span className="ml-1 text-blue-600 font-medium">📷 Photo</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800">{inr(p.amount)}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === 'Approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <span className="text-gray-400 text-xs ml-1">{expanded === p.id ? '▲' : '▼'}</span>
                </button>

                {/* Expanded detail */}
                {expanded === p.id && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-400">Date:</span> <span className="font-medium">{formatDateIST(p.date)}</span></div>
                      <div><span className="text-gray-400">Ref:</span> <span className="font-mono text-xs text-gray-500">{p.requestId}</span></div>
                      <div><span className="text-gray-400">Qty:</span> {p.quantity ? `${p.quantity} ${p.unit}` : '—'}</div>
                      <div><span className="text-gray-400">Urgency:</span> {p.urgency}</div>
                      {p.supplier && <div><span className="text-gray-400">Supplier:</span> {p.supplier}</div>}
                      {p.requestedBy && <div><span className="text-gray-400">Requested by:</span> {p.requestedBy}</div>}
                      {p.loggedBy && <div className="col-span-2 text-xs text-gray-500"><span className="text-gray-400">Logged by:</span> {p.loggedBy}</div>}
                      {p.notes && (
                        <div className="col-span-2"><span className="text-gray-400">Notes:</span> {p.notes}</div>
                      )}
                      {p.status === 'Rejected' && p.rejectionReason && (
                        <div className="col-span-2 text-red-600">
                          <span className="text-gray-400">Reason:</span> {p.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Photo with authenticated signed URL */}
                    {p.photoUrl && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1 font-medium">Chit / Bill Photo:</p>
                        <SecurePhoto
                          src={p.photoUrl}
                          alt={`Purchase bill for ${p.item}`}
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        ✎ Edit record
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id!)}
                        disabled={deleting === p.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? 'Deleting…' : 'Delete record'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editingPurchase && editForm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-lg">Edit Purchase Record</h3>
                <button
                  onClick={() => { setEditingPurchase(null); setEditForm(null); }}
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Urgency</label>
                    <select
                      value={editForm.urgency}
                      onChange={(e) => setEditForm({ ...editForm, urgency: e.target.value as Urgency })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {URGENCY_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item / Material</label>
                  <input
                    type="text"
                    required
                    value={editForm.item}
                    onChange={(e) => setEditForm({ ...editForm, item: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
                    <select
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier / Shop</label>
                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="border-t pt-3 space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">Approval Status</label>
                  <div className="flex gap-4">
                    {STATUS_OPTIONS.map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="editStatus"
                          value={s}
                          checked={editForm.status === s}
                          onChange={() => setEditForm({ ...editForm, status: s })}
                          className="accent-blue-600"
                        />
                        <span className={`text-xs font-semibold ${s === 'Approved' ? 'text-green-700' : 'text-red-600'}`}>
                          {s}
                        </span>
                      </label>
                    ))}
                  </div>
                  {editForm.status === 'Rejected' && (
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-red-600 mb-1">Rejection Reason *</label>
                      <input
                        type="text"
                        required
                        value={editForm.rejectionReason}
                        onChange={(e) => setEditForm({ ...editForm, rejectionReason: e.target.value })}
                        className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Photo Update */}
                <div className="border-t pt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Chit Photo (Optional)</label>
                  {editingPurchase.photoUrl && !newPhotoFile && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1">Current photo:</p>
                      <SecurePhoto src={editingPurchase.photoUrl} thumbnailClassName="h-28 object-contain rounded border" />
                    </div>
                  )}
                  <PhotoUpload
                    label={editingPurchase.photoUrl ? 'Replace Photo' : 'Upload Chit Photo'}
                    onFileSelect={setNewPhotoFile}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { setEditingPurchase(null); setEditForm(null); }}
                    className="px-4 py-2 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
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
