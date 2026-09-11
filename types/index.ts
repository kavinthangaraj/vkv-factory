export type WorkerName = 'Kavitha' | 'Hari' | 'Gopal' | 'Mathi';
export type Office = 'VKV' | 'Gangapuram';
export type PurchaseStatus = 'Approved' | 'Rejected';
export type Urgency = 'Normal' | 'Urgent';

export interface Purchase {
  id?: string;
  requestId: string;
  timestamp: Date;
  date?: string;
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
  date?: string;
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
