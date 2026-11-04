import {
  activityStatuses,
  activityTypes,
  type ActivityInput,
  type BudgetSummary,
  type DepartmentInput,
  type Store,
} from './models';

export function summarize(store: Store, activityId?: string, departmentId?: string): BudgetSummary {
  const activities = store.activities.filter((a) => !activityId || a.id === activityId);
  const ids = new Set(activities.map((a) => a.id));
  const expenses = store.expenses.filter(
    (e) => ids.has(e.activityId) && (!departmentId || e.departmentId === departmentId),
  );
  const departments = activities
    .flatMap((a) => a.departments)
    .filter((d) => !departmentId || d.id === departmentId);
  const allocated = departments.reduce((s, d) => s + d.allocation, 0);
  const budget = departmentId ? allocated : activities.reduce((s, a) => s + a.budget, 0);
  const recorded = expenses.reduce((s, e) => s + e.amount, 0);
  const paid = store.payments
    .filter((p) => expenses.some((e) => e.id === p.expenseId))
    .reduce((s, p) => s + p.amount, 0);
  const pending = expenses
    .filter((e) => e.state === 'Pending review')
    .reduce((s, e) => s + e.amount, 0);
  const openAssignments = store.assignments
    .filter(
      (a) =>
        ids.has(a.activityId) && (!departmentId || a.departmentId === departmentId) && !a.expenseId && a.purchasing?.status !== 'Cancelled',
    )
    .reduce((s, a) => s + a.budget, 0);
  const committed = Math.max(0, recorded - pending - paid) + openAssignments;
  return {
    budget,
    allocated,
    recorded,
    paid,
    pending,
    committed,
    remaining: budget - recorded,
    available: budget - paid - pending - committed,
    utilization: budget ? (recorded / budget) * 100 : recorded ? 100 : 0,
  };
}

export function parseMoney(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error('Enter a positive amount with up to two decimal places.');
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount > 100_000_000_000)
    throw new Error('Enter an amount up to 1,000,000,000.00.');
  return amount;
}

export function validateActivity(input: ActivityInput, allocated = 0) {
  if (!input.name.trim() || input.name.length > 100)
    throw new Error('Activity name is required and must be 100 characters or fewer.');
  if (!input.description.trim() || input.description.length > 2000)
    throw new Error('Add a description of up to 2,000 characters.');
  if (!activityTypes.includes(input.type) || !activityStatuses.includes(input.status))
    throw new Error('Choose a valid activity type and status.');
  const validDate = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!validDate(input.startDate) || !validDate(input.endDate) || input.endDate < input.startDate)
    throw new Error('Choose valid dates; the end date must be on or after the start date.');
  if (!Number.isSafeInteger(input.budget) || input.budget <= 0 || input.budget > 100_000_000_000)
    throw new Error('Overall budget must be greater than zero and within the supported limit.');
  if (input.budget < allocated)
    throw new Error(
      'Overall budget cannot be less than existing department allocations. Reduce allocations first.',
    );
}

export function validateDepartment(
  input: DepartmentInput,
  budget: number,
  others: number,
  duplicate: boolean,
) {
  if (!input.name.trim() || input.name.length > 80)
    throw new Error('Department name is required and must be 80 characters or fewer.');
  if (duplicate) throw new Error('A department with this name already exists in this activity.');
  if (input.head.length > 100 || input.description.length > 500)
    throw new Error('Keep the department lead under 100 characters and description under 500.');
  if (!Number.isSafeInteger(input.allocation) || input.allocation < 0)
    throw new Error('Allocation must be a valid non-negative amount.');
  if (input.allocation + others > budget)
    throw new Error(
      'Department allocations exceed the overall activity budget. Reduce this allocation or increase the activity budget.',
    );
}
