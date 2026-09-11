'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import { getPurchases, deletePurchase } from '@/lib/firestore';
import { STATUS_OPTIONS } from '@/lib/constants';
import type { Purchase } from '@/types';

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PurchaseListPage() {
  const [rows, setRows]                 = useState<Purchase[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate]     = useState('');
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getPurchases({
      status: filterStatus || undefined,
      date:   filterDate   || undefined,
    });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus, filterDate]); // eslint-disable-line

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this purchase record?')) return;
    setDeleting(id);
    await deletePurchase(id);
    setRows((r) => r.filter((x) => x.id !== id));
    setDeleting(null);
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
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Log Purchase
          </Link>
        </div>

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
        {!loading && rows.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between text-sm">
            <span className="text-gray-600">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
            <span className="font-semibold text-blue-700">Approved total: {inr(totalApproved)}</span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading…</p>
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
                      📅 {fmtDate(p.timestamp)} {p.supplier ? `· ${p.supplier}` : ''}
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
                      <div><span className="text-gray-400">Date:</span> <span className="font-medium">{fmtDate(p.timestamp)}</span></div>
                      <div><span className="text-gray-400">Ref:</span> <span className="font-mono text-xs text-gray-500">{p.requestId}</span></div>
                      <div><span className="text-gray-400">Qty:</span> {p.quantity ? `${p.quantity} ${p.unit}` : '—'}</div>
                      <div><span className="text-gray-400">Urgency:</span> {p.urgency}</div>
                      {p.supplier && <div><span className="text-gray-400">Supplier:</span> {p.supplier}</div>}
                      {p.notes && (
                        <div className="col-span-2"><span className="text-gray-400">Notes:</span> {p.notes}</div>
                      )}
                      {p.status === 'Rejected' && p.rejectionReason && (
                        <div className="col-span-2 text-red-600">
                          <span className="text-gray-400">Reason:</span> {p.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Photo */}
                    {p.photoUrl && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1 font-medium">Chit / Bill Photo:</p>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.photoUrl}
                            alt="Purchase photo"
                            className="w-full max-h-72 object-contain rounded-lg border border-gray-200 bg-white shadow-sm"
                          />
                          <p className="text-xs text-blue-600 hover:underline mt-1 text-center font-medium">
                            🔍 Click to open full-size image
                          </p>
                        </a>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-200 text-right">
                      <button
                        onClick={() => handleDelete(p.id!)}
                        disabled={deleting === p.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
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
      </main>
    </AuthGuard>
  );
}
