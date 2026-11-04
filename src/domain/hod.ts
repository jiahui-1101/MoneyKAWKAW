import type { Activity, Assignment, AuditEvent, ClubDirectory, Department, Expense, Payment, PurchasingDetails, Settings } from './models';
import type { DemoActor } from './session';

export interface HodScope { activity: Pick<Activity, 'id' | 'name' | 'startDate' | 'endDate' | 'status'>; department: Department }
export interface HodSnapshot {
  actor: DemoActor; scopes: HodScope[]; directory: ClubDirectory;
  assignments: Assignment[]; expenses: Expense[]; payments: Payment[]; events: AuditEvent[]; settings: Settings;
}
export type TaskInput = Pick<PurchasingDetails, 'name' | 'description' | 'assigneeId' | 'dueDate' | 'priority'> & { budget: number };
export const scopePath = (activityId: string, departmentId: string) => `/hod/activities/${activityId}/departments/${departmentId}`;
export function departmentBudget(data: HodSnapshot, activityId: string, departmentId: string) {
  const scope = data.scopes.find(s => s.activity.id === activityId && s.department.id === departmentId);
  if (!scope) throw new Error('You do not have access to this department.');
  const tasks = data.assignments.filter(t => t.activityId === activityId && t.departmentId === departmentId && t.purchasing?.status !== 'Cancelled');
  const expenses = data.expenses.filter(e => e.activityId === activityId && e.departmentId === departmentId);
  const planned = tasks.reduce((sum, t) => sum + t.budget, 0);
  const open = tasks.filter(t => !t.expenseId).reduce((sum, t) => sum + t.budget, 0);
  const recorded = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paid = data.payments.filter(p => expenses.some(e => e.id === p.expenseId)).reduce((sum, p) => sum + p.amount, 0);
  const pending = expenses.filter(e => e.state === 'Pending review').reduce((sum, e) => sum + e.amount, 0);
  const budget = scope.department.allocation;
  return { budget, planned, open, recorded, paid, pending, committed: open + recorded - pending - paid,
    remaining: budget - recorded, available: budget - recorded - open,
    purchasingCapacity: Math.min(budget - planned, budget - recorded - open),
    utilization: budget ? recorded / budget * 100 : recorded ? 100 : 0 };
}
export function departmentToday(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function isOverdue(task: Assignment, today: string) {
  return !!task.purchasing && ['Not Started', 'In Progress', 'Purchased'].includes(task.purchasing.status) && task.purchasing.dueDate < today;
}
export function eligibleMembers(data: HodSnapshot, activityId: string, departmentId: string) {
  return data.directory.users.filter(u => data.directory.memberships.some(m => m.active && m.userId === u.id && m.activityId === activityId && m.departmentId === departmentId));
}
