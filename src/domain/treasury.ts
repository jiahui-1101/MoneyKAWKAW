import type { Store } from './models';
export const reviewStates = ['Pending review', 'In review', 'Approved', 'Declined'] as const;
export interface ReceiptLine {
  id: string;
  description: string;
  amount: number;
  kind?: 'item' | 'tax' | 'discount';
  quantityMilli?: number;
  unitPrice?: number;
}
export interface ReceiptEdit {
  lineId: string;
  before: ReceiptLine;
  after: ReceiptLine;
  excluded: boolean;
  reason: string;
  actor: string;
  at: string;
  beforeExcluded?: boolean;
}
export interface ReceiptEvidence {
  id: string;
  expenseId: string;
  originalUrl: string;
  merchant: string;
  originalLines: ReceiptLine[];
  edits: ReceiptEdit[];
  submittedAt: string;
  file?: Omit<ProofFile, 'dataUrl'>;
  purchaseDate?: string;
  originalTotal?: number;
  addedLines?: ReceiptLine[];
  totalEdits?: { before: number; after: number; reason: string; actor: string; at: string }[];
  extraction?: { method: 'tesseract' | 'manual'; rawText: string; at: string };
}
export interface PayoutSnapshot {
  revision?: string;
  expenseId: string;
  ownerId: string;
  label: string;
  kind: 'Bank' | 'TNG';
  holder: string;
  institution: string;
  identifier: string;
  masked: string;
  accountId?: string;
  selectedAt?: string;
  selectedBy?: string;
  history?: { accountId?: string; masked: string; at: string; actor: string; reason: string }[];
}
export interface RiskRules {
  mediumVariance: number;
  highVariance: number;
  lowHeadroomPercent: number;
}
export interface RiskResult {
  id: string;
  at: string;
  actor: string;
  band: 'Low' | 'Medium' | 'High';
  factors: { label: string; detail: string; level: 'Low' | 'Medium' | 'High' }[];
  rules: RiskRules;
  variance: number;
  variancePercent: number;
  departmentAvailable: number;
  activityAvailable: number;
  pendingOther: number;
}
export interface ClaimReview {
  claimantId?: string;
  submittedAt: string;
  updatedAt: string;
  justification: string;
  reviewer?: string;
  reviewedAt?: string;
  reason?: string;
  analysis?: RiskResult;
  decisionAnalysis?: RiskResult;
}
export interface ProofFile {
  name: string;
  mime: 'image/png' | 'image/jpeg' | 'application/pdf';
  dataUrl: string;
  size: number;
}
export interface ManualPayment {
  destinationRevision?: string;
  reference: string;
  recordedAt: string;
  recordedBy: string;
  payout: Pick<PayoutSnapshot, 'kind' | 'label' | 'masked' | 'holder' | 'institution'>;
  proof: ProofFile;
  externalVerified: false;
  receivedConfirmedAt?: string;
  receivedConfirmedBy?: string;
  discrepancy?: {
    reason: string;
    reportedAt: string;
    reportedBy: string;
    receivedAmount?: number;
    resolvedAt?: string;
    resolvedBy?: string;
    resolutions?: { note: string; at: string; by: string }[];
  };
}
export interface TreasuryData {
  grants: { userId: string; activityId: string }[];
  receipts: ReceiptEvidence[];
  payouts: PayoutSnapshot[];
  rules: RiskRules;
}
export type TreasurySnapshot = Store;
