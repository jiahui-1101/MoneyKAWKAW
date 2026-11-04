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
  state: 'Pending review' | 'Approved';
}
export interface Payment {
  id: string;
  expenseId: string;
  amount: number;
  date: string;
}
export interface Assignment {
  id: string;
  activityId: string;
  departmentId: string;
  budget: number;
  expenseId?: string;
}
export interface AuditEvent {
  id: string;
  activityId: string;
  action: string;
  detail: string;
  at: string;
  actor: string;
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
