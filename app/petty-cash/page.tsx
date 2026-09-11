'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import { getPettyCash, deletePettyCash } from '@/lib/firestore';
import { OFFICES, CATEGORIES } from '@/lib/constants';
import type { PettyCash } from '@/types';

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [rows, setRows]                     = useState<PettyCash[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filterOffice, setFilterOffice]     = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDate, setFilterDate]         = useState('');
  const [expanded, setExpanded]             = useState<string | null>(null);
  const [deleting, setDeleting]             = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getPettyCash({
      office:   filterOffice   || undefined,
      category: filterCategory || undefined,
      date:     filterDate     || undefined,
    });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterOffice, filterCategory, filterDate]); // eslint-disable-line

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this petty cash entry?')) return;
    setDeleting(id);
    await deletePettyCash(id);
    setRows((r) => r.filter((x) => x.id !== id));
    setDeleting(null);
  };

  const total     = rows.reduce((s, r) => s + r.amount, 0);
  const vkvTotal  = rows.filter((r) => r.office === 'VKV').reduce((s, r) => s + r.amount, 0);
  const gangTotal = rows.filter((r) => r.office === 'Gangapuram').reduce((s, r) => s + r.amount, 0);

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

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          {/* Date Filter */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            title="Filter by Date"
          />

          {/* Office Filter */}
          <select
            value={filterOffice}
            onChange={(e) => setFilterOffice(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Offices</option>
            {OFFICES.map((o) => <option key={o}>{o}</option>)}
          </select>

          {/* Category Filter */}
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

        {/* Summary bar */}
        {!loading && rows.length > 0 && (
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

        {/* List */}
        {loading ? (
          <p className="text-center text-gray-400 py-12">Loading transactions…</p>
        ) : rows.length === 0 ? (
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
                  {/* Category badge */}
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
                      <span className="font-medium text-blue-700">{e.office}</span> · 📅 {fmtDate(e.timestamp)}
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
                      <div><span className="text-gray-400">Date:</span> <span className="font-medium">{fmtDate(e.timestamp)}</span></div>
                      <div><span className="text-gray-400">Office:</span> <span className="font-medium">{e.office}</span></div>
                      <div><span className="text-gray-400">Paid To:</span> {e.paidTo || '—'}</div>
                      <div><span className="text-gray-400">Entry Ref:</span> <span className="font-mono text-xs text-gray-500">{e.entryId}</span></div>
                      {e.notes && (
                        <div className="col-span-2"><span className="text-gray-400">Notes:</span> {e.notes}</div>
                      )}
                    </div>

                    {e.photoUrl && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1 font-medium">Notebook / Bill Photo:</p>
                        <a href={e.photoUrl} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={e.photoUrl}
                            alt="Notebook / Receipt"
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
                        onClick={() => handleDelete(e.id!)}
                        disabled={deleting === e.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        {deleting === e.id ? 'Deleting…' : 'Delete transaction'}
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
