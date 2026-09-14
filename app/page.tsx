'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { getDashboardStats } from '@/lib/firestore';
import type { Purchase, PettyCash } from '@/types';

interface Stats {
  purchasesToday: number;
  purchasesThisMonth: number;
  pettyTotalToday: number;
  pettyTotalThisMonth: number;
  pettyVKVThisMonth: number;
  pettyGangapuramThisMonth: number;
  recentPurchases: Purchase[];
  recentPettyCash: PettyCash[];
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${accent}`}>
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await getDashboardStats();
      setStats(s as Stats);
    } catch (err: unknown) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/purchase/new"
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl p-5 text-center transition-colors"
          >
            <div className="text-3xl mb-1">📋</div>
            <div className="font-semibold text-sm">Log Purchase</div>
          </Link>
          <Link
            href="/petty-cash/new"
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl p-5 text-center transition-colors"
          >
            <div className="text-3xl mb-1">💰</div>
            <div className="font-semibold text-sm">Log Petty Cash</div>
          </Link>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-center text-gray-500 text-sm">Loading dashboard stats…</p>
          </div>
        )}

        {loadError && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center my-4">
            <p className="text-red-700 font-semibold mb-1">Failed to load dashboard stats</p>
            <p className="text-gray-600 text-xs mb-4">{loadError}</p>
            <button
              onClick={fetchStats}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {stats && (
          <>
            {/* Purchase stats */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Purchases
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Today"      value={stats.purchasesToday}     accent="border-blue-500" />
                <StatCard label="This Month" value={stats.purchasesThisMonth} accent="border-blue-300" />
              </div>
            </section>

            {/* Petty cash stats */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Petty Cash
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Today"             value={inr(stats.pettyTotalToday)}          accent="border-green-500" />
                <StatCard label="This Month"        value={inr(stats.pettyTotalThisMonth)}       accent="border-green-400" />
                <StatCard label="VKV — Month"       value={inr(stats.pettyVKVThisMonth)}         accent="border-orange-400" />
                <StatCard label="Gangapuram — Month" value={inr(stats.pettyGangapuramThisMonth)} accent="border-purple-400" />
              </div>
            </section>

            {/* Recent purchases */}
            {stats.recentPurchases.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Recent Purchases
                  </h2>
                  <Link href="/purchase" className="text-xs text-blue-600 hover:underline">
                    View all →
                  </Link>
                </div>
                <div className="space-y-2">
                  {stats.recentPurchases.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.item}</p>
                        <p className="text-xs text-gray-500">
                          {fmtDate(p.timestamp)}{p.supplier ? ` · ${p.supplier}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-800">{inr(p.amount)}</p>
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
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent petty cash */}
            {stats.recentPettyCash.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Recent Petty Cash
                  </h2>
                  <Link href="/petty-cash" className="text-xs text-blue-600 hover:underline">
                    View all →
                  </Link>
                </div>
                <div className="space-y-2">
                  {stats.recentPettyCash.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{e.purpose}</p>
                        <p className="text-xs text-gray-500">
                          {e.office} · {fmtDate(e.timestamp)}{e.paidTo ? ` · ${e.paidTo}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 flex-shrink-0">
                        {inr(e.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {stats.recentPurchases.length === 0 && stats.recentPettyCash.length === 0 && (
              <p className="text-center text-gray-400 py-6">
                No records yet. Start by logging a purchase or petty cash entry.
              </p>
            )}
          </>
        )}
      </main>
    </AuthGuard>
  );
}
