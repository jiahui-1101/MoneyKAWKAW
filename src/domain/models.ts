import type { ClaimReview, ManualPayment, TreasuryData } from './treasury';
import type { MemberData } from './member';
export const activityTypes = ['Workshop', 'Large-scale event', 'Community', 'Other'] as const;
export const activityStatuses = ['Planning', 'Active', 'Completed'] as const;
export type ActivityType = (typeof activityTypes)[number];
export type ActivityStatus = (typeof activityStatuses)[number];
// Monetary values are integer minor units. Totals are always derived from records.
export interface Department {
  id: string;
  name: string;
  description: string;
  head: string;
  allocation: number;
  hodUserId?: string;
}
export interface Activity {
  id: string;
  name: string;
  description: string;
  type: ActivityType;
  status: ActivityStatus;
  startDate: string;
  endDate: string;
  budget: number;
  departments: Department[];
}
export interface Expense {
  id: string;
  activityId: string;
  departmentId: string;
  description: string;
  amount: number;
  date: string;
  state: 'Pending review' | 'In review' | 'Approved' | 'Declined';
  review?: ClaimReview;
}
export interface Payment {
  id: string;
  expenseId: string;
  amount: number;
  date: string;
  manual?: ManualPayment;
}
export interface Assignment {
  id: string;
  activityId: string;
  departmentId: string;
  budget: number;
  expenseId?: string;
  purchasing?: PurchasingDetails;
}
export interface AuditEvent {
  id: string;
  activityId: string;
  action: string;
  detail: string;
  at: string;
  actor: string;
  departmentId?: string;
  assignmentId?: string;
}
export interface Settings {
  currency: 'MYR' | 'SGD' | 'USD';
  timezone: string;
  warningPercent: number;
}
export interface Store {
  version: 1;
  activities: Activity[];
  expenses: Expense[];
  payments: Payment[];
  assignments: Assignment[];
  events: AuditEvent[];
  settings: Settings;
  directory?: ClubDirectory;
  treasury?: TreasuryData;
  member?: MemberData;
}

export const purchasingStatuses = [
  'Not Started',
  'In Progress',
  'Purchased',
  'Claim Submitted',
  'Completed',
  'Cancelled',
] as const;
export type PurchasingStatus = (typeof purchasingStatuses)[number];
export const priorities = ['Low', 'Medium', 'High'] as const;
export interface PurchasingDetails {
  name: string;
  description: string;
  assigneeId: string | null;
  dueDate: string;
  priority: (typeof priorities)[number];
  status: PurchasingStatus;
  createdBy: string;
  updatedAt: string;
}
export interface ClubUser {
  id: string;
  name: string;
}
export interface Membership {
  userId: string;
  activityId: string;
  departmentId: string;
  role: 'HOD' | 'Member';
  active: boolean;
}
export interface ClubDirectory {
  users: ClubUser[];
  memberships: Membership[];
}
export type ActivityInput = Omit<Activity, 'id' | 'departments'>;
export type DepartmentInput = Omit<Department, 'id'>;
export interface BudgetSummary {
  budget: number;
  allocated: number;
  recorded: number;
  committed: number;
  pending: number;
  paid: number;
  remaining: number;
  available: number;
  utilization: number;
}
