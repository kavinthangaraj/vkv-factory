'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/Navbar';
import {
  addCashLedgerBatch,
  getCashLedgerEntries,
  updateCashLedgerEntry,
  deleteCashLedgerEntry,
} from '@/lib/firestore';
import { parseCashLedgerMarkdown } from '@/lib/cashLedgerParser';
import { OFFICES } from '@/lib/constants';
import { getTodayIST, formatDateIST } from '@/lib/dateUtils';
import type { Office, CashLedgerEntry, CashLedgerParsedRow, CashLedgerParseError } from '@/types';

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

interface ReviewRow extends CashLedgerParsedRow {
  _key: string;
}

let _rowSeq = 0;
function makeKey() {
  return `row-${++_rowSeq}-${Date.now()}`;
}

export default function CashLedgerPage() {
  // ── Import form state ──────────────────────────────────────────────────────
  const [date, setDate] = useState<string>(getTodayIST());
  const [office, setOffice] = useState<Office>('VKV');
  const [filename, setFilename] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [parseErrors, setParseErrors] = useState<CashLedgerParseError[]>([]);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [parseErrorsPersisted, setParseErrorsPersisted] = useState<CashLedgerParseError[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedBatchId, setSavedBatchId] = useState('');

  // ── Saved entries state ────────────────────────────────────────────────────
  const [savedRows, setSavedRows] = useState<CashLedgerEntry[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOffice, setFilterOffice] = useState<Office | ''>('');
  const [filterBatch, setFilterBatch] = useState('');

  // ── Edit modal state ───────────────────────────────────────────────────────
  const [editingEntry, setEditingEntry] = useState<CashLedgerEntry | null>(null);
  const [editForm, setEditForm] = useState<{
    purpose: string;
    creditAmount: string;
    debitAmount: string;
    notes: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse file on upload ───────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.md')) {
      setSaveError('Only .md (Markdown) files are supported.');
      return;
    }

    setFilename(file.name);
    setSaveError('');
    setParseErrors([]);
    setParseErrorsPersisted([]);
    setSavedBatchId('');
    setReviewRows([]);

    try {
      const content = await file.text();
      setRawContent(content);
      const result = parseCashLedgerMarkdown(content);

      if (result.errors.length) {
        setParseErrors(result.errors);
      }

      const rows: ReviewRow[] = result.rows.map((r) => ({ ...r, _key: makeKey() }));
      setReviewRows(rows);
      setParseErrorsPersisted(result.errors);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to read file.');
    }

    // Reset input so re-uploading same file triggers again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Review table helpers ───────────────────────────────────────────────────
  const updateReviewRow = (key: string, field: keyof CashLedgerParsedRow, value: string | number) => {
    setReviewRows((prev) =>
      prev.map((r) =>
        r._key === key ? { ...r, [field]: value } : r,
      ),
    );
  };

  const addEmptyRow = () => {
    setReviewRows((prev) => [
      ...prev,
      { _key: makeKey(), purpose: '', creditAmount: 0, debitAmount: 0, notes: '' },
    ]);
  };

  const removeReviewRow = (key: string) => {
    setReviewRows((prev) => prev.filter((r) => r._key !== key));
  };

  const totalCredits = reviewRows.reduce((s, r) => s + (Number(r.creditAmount) || 0), 0);
  const totalDebits  = reviewRows.reduce((s, r) => s + (Number(r.debitAmount) || 0), 0);
  const netBalance   = Math.round((totalCredits - totalDebits) * 100) / 100;

  // ── Save batch ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!reviewRows.length) {
      setSaveError('No rows to save. Upload a .md file or add rows manually.');
      return;
    }

    for (let i = 0; i < reviewRows.length; i++) {
      const r = reviewRows[i];
      if (!r.purpose.trim()) {
        setSaveError(`Row #${i + 1}: Purpose cannot be empty.`);
        return;
      }
      if ((Number(r.creditAmount) || 0) < 0 || (Number(r.debitAmount) || 0) < 0) {
        setSaveError(`Row #${i + 1}: Amounts must be non-negative.`);
        return;
      }
      if ((Number(r.creditAmount) || 0) === 0 && (Number(r.debitAmount) || 0) === 0) {
        setSaveError(`Row #${i + 1}: Must have either credit or debit > 0.`);
        return;
      }
    }

    setSaving(true);
    setSaveError('');

    try {
      const batchId = await addCashLedgerBatch({
        date,
        office,
        sourceFilename: filename || undefined,
        rows: reviewRows.map(({ _key: _, ...rest }) => rest),
      });

      setSavedBatchId(batchId);
      setReviewRows([]);
      setParseErrors([]);
      setParseErrorsPersisted([]);
      setRawContent('');
      setFilename('');
      loadSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save batch.');
    } finally {
      setSaving(false);
    }
  };

  // ── Load saved entries ─────────────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    setLoadError('');
    try {
      const data = await getCashLedgerEntries({
        date:     filterDate     || undefined,
        office:   (filterOffice as Office) || undefined,
        batchId:  filterBatch    || undefined,
      });
      setSavedRows(data);
    } catch (err: unknown) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load saved entries.');
    } finally {
      setLoadingSaved(false);
    }
  }, [filterDate, filterOffice, filterBatch]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  // ── Edit saved entry ───────────────────────────────────────────────────────
  const startEdit = (e: CashLedgerEntry) => {
    setEditingEntry(e);
    setEditForm({
      purpose:     e.purpose,
      creditAmount: String(e.creditAmount),
      debitAmount:  String(e.debitAmount),
      notes:        e.notes || '',
    });
    setEditError('');
  };

  const handleSaveEdit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!editingEntry || !editForm) return;

    const credit = Number(editForm.creditAmount) || 0;
    const debit  = Number(editForm.debitAmount) || 0;

    if (!editForm.purpose.trim()) { setEditError('Purpose cannot be empty.'); return; }
    if (credit < 0 || debit < 0) { setEditError('Amounts must be non-negative.'); return; }
    if (credit === 0 && debit === 0) { setEditError('Must have either credit or debit > 0.'); return; }

    setEditSaving(true);
    setEditError('');

    try {
      await updateCashLedgerEntry(editingEntry.id!, {
        purpose:      editForm.purpose.trim(),
        creditAmount: credit,
        debitAmount:  debit,
        notes:        editForm.notes.trim(),
      });

      setSavedRows((prev) =>
        prev.map((item) =>
          item.id === editingEntry.id
            ? { ...item, purpose: editForm.purpose.trim(), creditAmount: credit, debitAmount: debit, notes: editForm.notes.trim() }
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

  // ── Delete saved entry ─────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cash ledger entry?')) return;
    setDeleting(id);
    try {
      await deleteCashLedgerEntry(id);
      setSavedRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to delete entry.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Saved entries summary ──────────────────────────────────────────────────
  const savedCredits = savedRows.reduce((s, r) => s + r.creditAmount, 0);
  const savedDebits  = savedRows.reduce((s, r) => s + r.debitAmount, 0);

  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Cash Ledger Import</h1>
          <p className="text-xs text-gray-500">Upload a Markdown table, review parsed rows, and save to the database</p>
        </div>

        {/* ── Import Form ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">1. Date, Office &amp; File</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office <span className="text-red-500">*</span></label>
              <div className="flex gap-4 mt-2">
                {OFFICES.map((o) => (
                  <label key={o} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cashLedgerOffice"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Markdown File <span className="text-red-500">*</span></label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {filename && (
              <p className="text-xs text-green-600 mt-1 font-medium">Loaded: {filename}</p>
            )}
          </div>
        </div>

        {/* ── Parse Errors ─────────────────────────────────────────────────── */}
        {parseErrorsPersisted.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-red-700 mb-2">
              Parse Errors ({parseErrorsPersisted.length})
            </h3>
            <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
              {parseErrorsPersisted.map((err, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-red-500">Line {err.line}:</span>
                  <span>{err.message}</span>
                  {err.raw && <span className="text-red-400 font-mono">({err.raw})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Review Table ─────────────────────────────────────────────────── */}
        {reviewRows.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  2. Review Parsed Rows ({reviewRows.length})
                </h2>
                <p className="text-xs text-gray-500">Edit values below before saving. All rows are required to have a purpose and at least one amount &gt; 0.</p>
              </div>
              <div className="text-right text-sm">
                <span className="text-gray-400 text-xs">Credits:</span>{' '}
                <span className="font-bold text-green-700">{inr(totalCredits)}</span>
                <br />
                <span className="text-gray-400 text-xs">Debits:</span>{' '}
                <span className="font-bold text-red-600">{inr(totalDebits)}</span>
                <br />
                <span className="text-gray-400 text-xs">Net:</span>{' '}
                <span className={`font-bold ${netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{inr(netBalance)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Purpose</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Credit (₹)</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Debit (₹)</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviewRows.map((row, idx) => (
                    <tr key={row._key} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          required
                          value={row.purpose}
                          onChange={(e) => updateReviewRow(row._key, 'purpose', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          placeholder="Expense purpose"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.creditAmount || ''}
                          onChange={(e) => updateReviewRow(row._key, 'creditAmount', Number(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right font-mono"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.debitAmount || ''}
                          onChange={(e) => updateReviewRow(row._key, 'debitAmount', Number(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right font-mono"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.notes || ''}
                          onChange={(e) => updateReviewRow(row._key, 'notes', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                          placeholder="Notes"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeReviewRow(row._key)}
                          className="text-red-400 hover:text-red-600 text-xs font-bold"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addEmptyRow}
              className="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:text-blue-700 text-gray-500 font-semibold text-sm rounded-xl transition-colors"
            >
              + Add Empty Row
            </button>

            {saveError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{saveError}</p>
            )}
            {savedBatchId && (
              <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                Saved batch {savedBatchId} successfully.
              </p>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Net for review</p>
                <p className={`text-xl font-bold ${netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{inr(netBalance)}</p>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || reviewRows.length === 0}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : `Save ${reviewRows.length} Row${reviewRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Empty State for Import ───────────────────────────────────────── */}
        {reviewRows.length === 0 && !parseErrorsPersisted.length && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl mb-2">📒</p>
            <p className="text-gray-500 text-sm">Upload a Markdown file to import cash ledger entries.</p>
            <p className="text-xs text-gray-400 mt-1">See <code className="bg-gray-100 px-1 rounded">docs/examples/cash-ledger.md</code> for the expected format.</p>
          </div>
        )}

        {/* ── Saved Entries Section ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Saved Cash Ledger Entries</h2>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              title="Filter by Date"
            />
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value as Office | '')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">All Offices</option>
              {OFFICES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input
              type="text"
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              placeholder="Batch ID"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white w-48"
            />
            {(filterDate || filterOffice || filterBatch) && (
              <button
                onClick={() => { setFilterDate(''); setFilterOffice(''); setFilterBatch(''); }}
                className="text-sm text-red-500 hover:underline px-2 py-1"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Summary */}
          {savedRows.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 grid grid-cols-3 gap-2 text-sm text-center">
              <div>
                <p className="text-gray-500 text-xs">Entries ({savedRows.length})</p>
                <p className="font-bold text-blue-700">{inr(savedCredits + savedDebits)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total Credits</p>
                <p className="font-bold text-green-700">{inr(savedCredits)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Total Debits</p>
                <p className="font-bold text-red-600">{inr(savedDebits)}</p>
              </div>
            </div>
          )}

          {/* Loading / Error / Empty */}
          {loadingSaved ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-gray-500 text-xs">Loading…</p>
            </div>
          ) : loadError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-700 text-sm font-semibold mb-1">Failed to load entries</p>
              <p className="text-red-600 text-xs mb-2">{loadError}</p>
              <button onClick={loadSaved} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg">
                Retry
              </button>
            </div>
          ) : savedRows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No entries match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Office</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Purpose</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Credit</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-right">Debit</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Source</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {savedRows.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-medium">{formatDateIST(e.date)}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-blue-700">{e.office}</td>
                      <td className="px-3 py-2 text-sm">{e.purpose}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono text-green-700">
                        {e.creditAmount > 0 ? inr(e.creditAmount) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-mono text-red-600">
                        {e.debitAmount > 0 ? inr(e.debitAmount) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px] truncate">{e.notes || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[100px] truncate">{e.sourceFilename || '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(e)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold mr-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id!)}
                          disabled={deleting === e.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          {deleting === e.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Edit Modal ───────────────────────────────────────────────────── */}
        {editingEntry && editForm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-lg">Edit Cash Ledger Entry</h3>
                <button
                  onClick={() => { setEditingEntry(null); setEditForm(null); }}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              {editError && (
                <div className="bg-red-50 text-red-700 border border-red-200 text-xs rounded-lg p-3">{editError}</div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Purpose</label>
                  <input
                    type="text"
                    required
                    value={editForm.purpose}
                    onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Credit (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.creditAmount}
                      onChange={(e) => setEditForm({ ...editForm, creditAmount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Debit (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.debitAmount}
                      onChange={(e) => setEditForm({ ...editForm, debitAmount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
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

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-gray-400">
                    {editingEntry.batchId} · {editingEntry.sourceFilename || 'manual'}
                  </span>
                  <div className="flex items-center gap-3">
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
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
