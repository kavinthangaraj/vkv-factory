export type WorkerName = 'Kavitha' | 'Hari' | 'Gopal' | 'Mathi';
export type Office = 'VKV' | 'Gangapuram';
export type PurchaseStatus = 'Approved' | 'Rejected';
export type Urgency = 'Normal' | 'Urgent';

export interface Purchase {
  id?: string;
  requestId: string;
  timestamp: Date;
  date: string; // YYYY-MM-DD (India Standard Time)
  requestedBy?: string;
  item: string;
  quantity: number;
  unit: string;
  amount: number;
  supplier: string;
  urgency: Urgency;
  notes: string;
  status: PurchaseStatus;
  rejectionReason?: string;
  photoUrl?: string;
  loggedBy?: string;
}

export interface PettyCash {
  id?: string;
  entryId: string;
  timestamp: Date;
  date: string; // YYYY-MM-DD (India Standard Time)
  office: Office;
  enteredBy?: string;
  amount: number;
  paidTo: string;
  purpose: string;
  category: string;
  notes: string;
  photoUrl?: string;
  loggedBy?: string;
}

export interface CashLedgerEntry {
  id?: string;
  batchId: string;
  date: string; // YYYY-MM-DD (India Standard Time)
  transactionDate?: string;
  office: Office;
  purpose: string;
  creditAmount: number;
  debitAmount: number;
  notes?: string;
  sourceFilename?: string;
  loggedBy?: string;
  createdAt?: Date;
}

export interface CashLedgerParsedRow {
  purpose: string;
  creditAmount: number;
  debitAmount: number;
  notes?: string;
}

export interface CashLedgerParseError {
  line: number;
  raw: string;
  message: string;
}

export interface CashLedgerParseResult {
  rows: CashLedgerParsedRow[];
  errors: CashLedgerParseError[];
  totalCredits: number;
  totalDebits: number;
  netBalance: number;
}
