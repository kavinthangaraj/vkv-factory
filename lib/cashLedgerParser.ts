import type {
  CashLedgerParsedRow,
  CashLedgerParseError,
  CashLedgerParseResult,
} from '@/types';

export type { CashLedgerParsedRow, CashLedgerParseError, CashLedgerParseResult };

/**
 * Splits a markdown table row into individual cell strings,
 * properly handling leading and trailing pipes.
 */
function splitMarkdownCells(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

/**
 * Checks if a table row is a separator row (e.g. `|---|---:|:---|`).
 */
function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

interface ColumnMapping {
  purposeIndex: number;
  creditIndex: number;
  debitIndex: number;
  notesIndex: number;
}

/**
 * Inspects a candidate header row and identifies column indexes for:
 * - Purpose / Expense
 * - Credit Amount
 * - Debit Amount
 * - Notes (optional)
 */
function identifyColumns(cells: string[]): ColumnMapping | null {
  let purposeIndex = -1;
  let creditIndex = -1;
  let debitIndex = -1;
  let notesIndex = -1;

  cells.forEach((rawCell, idx) => {
    const cell = rawCell.toLowerCase().replace(/[*_`]/g, '').trim();

    // 1. Credit check
    if (/credit|income|receipt|cash\s*in/.test(cell)) {
      creditIndex = idx;
      return;
    }

    // 2. Debit check
    if (/debit|cash\s*out|payment|spent|expense\s*amount/.test(cell)) {
      debitIndex = idx;
      return;
    }

    // 3. Notes check
    if (/note|remark|comment|detail/.test(cell) && !/expense|purpose|item/.test(cell)) {
      notesIndex = idx;
      return;
    }

    // 4. Purpose / Expense / Description
    if (
      /purpose|expense|description|particular|item/.test(cell) &&
      !/amount|credit|debit/.test(cell)
    ) {
      purposeIndex = idx;
      return;
    }
  });

  // Fallback heuristic: If purpose not found, look for first non-amount column
  if (purposeIndex === -1) {
    cells.forEach((rawCell, idx) => {
      if (idx !== creditIndex && idx !== debitIndex && idx !== notesIndex && purposeIndex === -1) {
        purposeIndex = idx;
      }
    });
  }

  // Must have purpose, credit, and debit columns
  if (purposeIndex !== -1 && creditIndex !== -1 && debitIndex !== -1) {
    return { purposeIndex, creditIndex, debitIndex, notesIndex };
  }

  return null;
}

interface ParsedAmount {
  value: number;
  isValid: boolean;
  raw: string;
}

/**
 * Cleans and parses a currency/amount string.
 * Supports:
 * - Currency symbols: ₹, Rs, Rs., INR, $
 * - Trailing Indian shorthand: /- (e.g. "500/-")
 * - Commas in numbers: "10,000"
 * - Blank, "-", "—", "nil" parsed as 0
 */
function parseAmount(raw: string): ParsedAmount {
  const trimmed = raw.trim();

  // Blank or dash defaults to 0
  if (!trimmed || /^[-—–]|nil|null|none$/i.test(trimmed)) {
    return { value: 0, isValid: true, raw };
  }

  // Remove currency prefixes/suffixes and punctuation
  let cleaned = trimmed
    .replace(/^(₹|Rs\.?|INR|\$)\s*/i, '')
    .replace(/\s*(₹|Rs\.?|INR|\$)$/i, '')
    .replace(/\/-\s*$/, '') // Remove trailing /-
    .replace(/,/g, '')      // Remove thousand separators
    .trim();

  if (!cleaned) {
    return { value: 0, isValid: true, raw };
  }

  // Check valid positive/negative decimal pattern
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { value: 0, isValid: false, raw };
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    return { value: 0, isValid: false, raw };
  }

  return { value: num, isValid: true, raw };
}

/**
 * Pure Markdown table parser for Cash Ledger imports.
 * Parses lines into structured rows with review validation.
 */
export function parseCashLedgerMarkdown(content: string): CashLedgerParseResult {
  const rows: CashLedgerParsedRow[] = [];
  const errors: CashLedgerParseError[] = [];

  if (!content || !content.trim()) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          raw: '',
          message: 'The file is empty. Please provide a Markdown file containing a cash ledger table.',
        },
      ],
      totalCredits: 0,
      totalDebits: 0,
      netBalance: 0,
    };
  }

  const lines = content.split(/\r?\n/);
  let columnMap: ColumnMapping | null = null;
  let headerLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Ignore blank lines
    if (!trimmed) continue;

    // Ignore markdown headings (e.g. # Daily Cash Ledger)
    if (/^#{1,6}\s+/.test(trimmed)) continue;

    // Ignore markdown horizontal rules (e.g. --- or *** or ___) outside tables
    if (/^([-*_])\s*\1\s*\1+$/.test(trimmed)) continue;

    // Line with pipes
    if (trimmed.includes('|')) {
      const cells = splitMarkdownCells(trimmed);

      // Check if separator line
      if (isSeparatorRow(cells)) {
        continue;
      }

      // If we don't have columns yet, try to identify this as the header row
      if (!columnMap) {
        const detected = identifyColumns(cells);
        if (detected) {
          columnMap = detected;
          headerLineIndex = i;
          continue;
        } else {
          // If the line looked like a table row but couldn't match required headers
          errors.push({
            line: lineNumber,
            raw: line,
            message:
              'Table header row found but could not match required columns. Expected: Purpose/Expense, Credit Amount, and Debit Amount.',
          });
          continue;
        }
      }

      // We have an identified header, so this is a data row
      const rawPurpose = (cells[columnMap.purposeIndex] || '').trim();
      const rawCredit  = (cells[columnMap.creditIndex]  || '').trim();
      const rawDebit   = (cells[columnMap.debitIndex]   || '').trim();
      const rawNotes   =
        columnMap.notesIndex !== -1 && columnMap.notesIndex < cells.length
          ? cells[columnMap.notesIndex].trim()
          : '';

      const creditParsed = parseAmount(rawCredit);
      const debitParsed  = parseAmount(rawDebit);

      // Validation 1: Expense / Purpose is required
      if (!rawPurpose) {
        errors.push({
          line: lineNumber,
          raw: line,
          message: 'Expense / Purpose cannot be empty.',
        });
        continue;
      }

      // Validation 2: Credit amount validity
      if (!creditParsed.isValid) {
        errors.push({
          line: lineNumber,
          raw: line,
          message: `Invalid credit amount "${rawCredit}". Must be a valid non-negative number.`,
        });
        continue;
      }
      if (creditParsed.value < 0) {
        errors.push({
          line: lineNumber,
          raw: line,
          message: `Credit amount cannot be negative (${creditParsed.value}).`,
        });
        continue;
      }

      // Validation 3: Debit amount validity
      if (!debitParsed.isValid) {
        errors.push({
          line: lineNumber,
          raw: line,
          message: `Invalid debit amount "${rawDebit}". Must be a valid non-negative number.`,
        });
        continue;
      }
      if (debitParsed.value < 0) {
        errors.push({
          line: lineNumber,
          raw: line,
          message: `Debit amount cannot be negative (${debitParsed.value}).`,
        });
        continue;
      }

      // Validation 4: At least one amount > 0
      if (creditParsed.value === 0 && debitParsed.value === 0) {
        errors.push({
          line: lineNumber,
          raw: line,
          message: `Row "${rawPurpose}" must have either Credit or Debit greater than 0.`,
        });
        continue;
      }

      // Row is valid!
      rows.push({
        purpose:      rawPurpose,
        creditAmount: Math.round(creditParsed.value * 100) / 100,
        debitAmount:  Math.round(debitParsed.value * 100) / 100,
        notes:        rawNotes || undefined,
      });
    } else {
      // Non-blank line without pipes
      if (headerLineIndex === -1) {
        // If before header, ignore commentary or note
        continue;
      } else {
        // Malformed line inside or after data table
        errors.push({
          line: lineNumber,
          raw: line,
          message: 'Malformed line: expected a Markdown table row with "|" separators.',
        });
      }
    }
  }

  // If no header was found across the entire content
  if (!columnMap) {
    errors.unshift({
      line: 1,
      raw: lines[0] || '',
      message:
        'No valid table header found. The Markdown file must contain a table with columns: | Expense / Purpose | Credit Amount | Debit Amount |',
    });
  }

  const totalCredits = rows.reduce((s, r) => s + r.creditAmount, 0);
  const totalDebits  = rows.reduce((s, r) => s + r.debitAmount, 0);
  const netBalance   = Math.round((totalCredits - totalDebits) * 100) / 100;

  return {
    rows,
    errors,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits:  Math.round(totalDebits * 100) / 100,
    netBalance,
  };
}
