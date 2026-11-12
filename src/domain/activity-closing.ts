export type FinancialActivityState = 'Open' | 'Closing' | 'Treasurer Reconciled' | 'Director Approved' | 'Archiving' | 'Archived';
export const canPlanActivity = (state: FinancialActivityState | undefined) => !state || state === 'Open';

export const financialStateLabel = (state: FinancialActivityState | undefined, fallback: string) =>
  state === 'Archived' ? 'Archived — Read Only' : state && state !== 'Open' ? state : fallback;

export const closingChecklist = {
  unresolvedTasks: ['Unresolved purchasing tasks', 'Ask the assigned HOD to cancel unfinished work or record why a completed purchase needs no reimbursement.'],
  draftClaims: ['Draft claims', 'Ask the claimant to finish and submit their existing draft.'],
  pendingClaims: ['Pending claims', 'Start review in the Treasurer claim queue.'],
  underReview: ['Claims under review', 'Record the Treasurer’s decision in the claim.'],
  approvedUnpaid: ['Approved but unpaid', 'Complete the existing reimbursement workflow.'],
  paymentPending: ['Payments pending', 'Retain the transfer proof and record the reimbursement.'],
  unconfirmedPaid: ['Paid, awaiting receipt', 'Ask the claimant to confirm receipt in their claim.'],
  openDiscrepancies: ['Open payment discrepancies', 'Resolve the payment issue in the Treasurer workspace.'],
  stagedReceipts: ['Incomplete receipt uploads', 'Ask the claimant to finish or abandon the draft upload.'],
  stagedProofs: ['Incomplete proof uploads', 'Finish the proof upload or have its Treasurer abandon the staging record.'],
  inconsistentPayments: ['Inconsistent payment records', 'Review payment amounts, proof and claimant confirmations.'],
  claimTotalsOrReceipt: ['Unreconciled claim lines or receipts', 'Compare the submitted totals with the finalized receipt and included lines.'],
  missingAudit: ['Missing financial audit history', 'Restore the original review and transition records before signing.'],
  missingEvidence: ['Missing or mismatched evidence metadata', 'Restore the original receipt or proof in its private Storage location.'],
  budgetInconsistency: ['Budget inconsistency', 'Review the canonical balances and ask a Director to reopen for a budget correction if needed.'],
} as const;

export interface ClosingFacts {
  budget: number; allocated: number; paid: number; unspentAllocated: number; unallocated: number;
  planned: number; reserved: number; pending: number; liability: number; available: number;
  payments: number; paymentTotal: number; confirmed: number; evidenceCount: number;
  taskCount: number; estimated: number; claimStates: Record<string, number>;
  departments: { departmentId: string; name: string; budget: number; paid: number; remaining: number }[];
  audit: { count: number; first: string | null; last: string | null };
  blockers: Record<keyof typeof closingChecklist, number>;
}

interface ClosingDecision {
  approved: boolean; decided_name: string; decided_at: string; reason: string;
}

export interface ClosingReport {
  state: FinancialActivityState;
  revision: number;
  facts: ClosingFacts;
  independentDirectorExists: boolean;
  canDecide: boolean;
  reconciliation: { id: string; version: number; signed_name: string; signed_at: string } | null;
  decision: ClosingDecision | null;
  history: { id: string; version: number; signedAt: string; signedName: string; decision: ClosingDecision | null }[];
  archive: {
    id: string; verification_state: 'Pending' | 'Verified' | 'Failed'; checked_at: string | null;
    failure_code: string | null; logical_sha256: string; compressed_sha256: string | null;
    logical_bytes: number; compressed_bytes: number | null; verified_evidence_count: number | null;
    evidence_bytes: number | null; legal_hold: boolean; retain_until: string | null;
    retention_policy: { id: string; days: number } | null;
    recovery_checked_at: string | null;
    recovery_report: { result: 'Passed'; rows: number; evidence: number } | null;
  } | null;
}

export interface CleanupPreview {
  candidateCount: number;
  potentialBytes: number;
  eligibleForReview: boolean;
  candidates: { id: string; kind: string; bytes: number }[];
}
