import type { Activity, Assignment, AuditEvent, ClubDirectory, Department, Expense, Payment, Settings } from './models';
import type { PayoutSnapshot, ReceiptEvidence } from './treasury';
export interface PaymentAccount {
  id: string;
  ownerId: string;
  label: string;
  kind: 'Bank' | 'TNG';
  holder: string;
  institution: string;
  identifier: string;
  masked: string;
  isDefault: boolean;
  updatedAt: string;
}
export type AccountSummary = Omit<PaymentAccount,'identifier'>;
export interface ClaimDraft {
  id: string;
  ownerId: string;
  taskId: string;
  receipt?: ReceiptEvidence;
  accountId: string;
  justification: string;
  updatedAt: string;
}
export interface MemberData {
  accounts: PaymentAccount[];
  drafts: ClaimDraft[];
  readNotifications: {userId:string;ids:string[]}[];
}
export interface MemberScope {
  activity: Pick<Activity,'id'|'name'|'description'|'type'|'status'|'startDate'|'endDate'>;
  department: Pick<Department,'id'|'name'|'description'|'head'|'hodUserId'|'allocation'>;
}
export interface MemberSnapshot {
  userId: string;
  scopes: MemberScope[];
  directory: ClubDirectory;
  assignments: Assignment[];
  expenses: Expense[];
  payments: Payment[];
  events: AuditEvent[];
  accounts: AccountSummary[];
  drafts: Omit<ClaimDraft,'receipt'>[];
  readNotifications: string[];
  settings: Settings;
}
export type AccountInput = Pick<PaymentAccount,'label'|'kind'|'holder'|'institution'|'identifier'|'isDefault'>;
export type SelectedDestination = Pick<PayoutSnapshot,'kind'|'label'|'masked'|'holder'|'institution'>;
