export const roles = ['Director', 'Treasurer', 'HOD', 'Member'] as const;
export type Role = (typeof roles)[number];
export interface ClubMember {
  uid: string;
  name: string;
  active: boolean;
  roles: Role[];
  revision: number;
}
export interface ActivityMembership {
  active: boolean;
  treasurer: boolean;
  departmentRoles: Record<string, ('HOD' | 'Member')[]>;
}
export type SessionProfile = ClubMember;
export interface ClubProfile {
  name: string; currency: 'MYR'; timezone: string; warningPercent: number;
}
export interface RecordMetadata<T = string> {
  schemaVersion: 1;
  revision: number;
  createdAt: T;
  updatedAt: T;
  createdBy: string;
}
export interface ArchiveMetadata<T = string> {
  archivedAt: T | null;
  archivedBy: string | null;
  retainUntil: T | null;
  legalHold: boolean;
}
export interface ActivityRecord<T = string> extends RecordMetadata<T> {
  name: string;
  description: string;
  type: 'Workshop' | 'Large-scale event' | 'Community' | 'Other';
  status: 'Planning' | 'Active' | 'Completed';
  startDate: string;
  endDate: string;
  budget: number; // Integer sen. Currency cannot be silently relabelled.
  currency: 'MYR';
  archive: ArchiveMetadata<T>;
}
export interface DepartmentRecord<T = string> extends RecordMetadata<T> {
  activityId: string;
  name: string;
  description: string;
  head: string;
  hodUserId: string | null;
  allocation: number; // Canonical department budget allocation in sen.
}
export interface ScopedRecord<T = string> extends RecordMetadata<T> {
  activityId: string;
  departmentId: string;
}
export interface TaskRecord<T = string> extends ScopedRecord<T> {
  name: string; description: string; assigneeUid: string | null;
  budget: number; dueDate: string; claimId: string | null;
  status: 'Not Started' | 'In Progress' | 'Purchased' | 'Claim Submitted' | 'Completed' | 'Cancelled';
}
export interface ClaimRecord<T = string> extends ScopedRecord<T> {
  claimantUid: string; assignmentId: string | null; amount: number; currency: 'MYR';
  receiptId: string; versionId: string; destinationRevision: string;
  state: 'Draft' | 'Pending review' | 'In review' | 'Approved' | 'Declined';
}
export interface ReceiptRecord<T = string> extends ScopedRecord<T> {
  ownerUid: string; claimId: string | null; objectPath: string;
  generation: string; sha256: string; ready: boolean;
}
export interface ReceiptModification<T = string> extends RecordMetadata<T> {
  receiptId: string; lineId: string; before: string; after: string;
  beforeExcluded: boolean; excluded: boolean; reason: string;
}
export interface PaymentAccountRecord<T = string> extends RecordMetadata<T> {
  ownerUid: string; kind: 'Bank' | 'TNG'; label: string; masked: string;
  institution: string; preferred: boolean; secretId: string;
}
export interface ReimbursementRecord<T = string> extends ScopedRecord<T> {
  claimId: string; claimantUid: string; amount: number; paidDate: string;
  proofId: string; destinationRevision: string; recordedBy: string;
  externalVerified: false;
}
export interface NotificationRecord<T = string> extends RecordMetadata<T> {
  ownerUid: string; title: string; recordId: string; readAt: T | null;
}
export interface AuditRecord<T = string> {
  actorUid: string; at: T; action: string; recordId: string;
  activityId: string | null; departmentId: string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}
export const clubPath = 'clubs/main';
export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export function validSen(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000;
}
