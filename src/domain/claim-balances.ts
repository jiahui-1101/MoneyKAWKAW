import type { Assignment, Expense } from './models';
export const isRecorded = (e: Expense) => e.state !== 'Declined';
export const isPending = (e: Expense) => e.state === 'Pending review' || e.state === 'In review';
export function isReservation(task: Assignment, expenses: Expense[]) {
  return (
    task.purchasing?.status !== 'Cancelled' &&
    (!task.expenseId || expenses.some((e) => e.id === task.expenseId && e.state === 'Declined'))
  );
}
