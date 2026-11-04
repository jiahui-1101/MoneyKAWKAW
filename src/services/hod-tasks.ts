import type { Assignment, PurchasingStatus, Store } from '../domain/models';
import { departmentBudget, type TaskInput } from '../domain/hod';
import { assertHodScope, projectHod } from './hod-access';

export const nextPurchasingStates: Partial<Record<PurchasingStatus, PurchasingStatus[]>> = {
  'Not Started': ['In Progress', 'Purchased'],
  'In Progress': ['Purchased'],
  Purchased: ['Completed'],
};
function editable(
  store: Store,
  activityId: string,
  departmentId: string,
  id: string,
  expected?: string,
) {
  assertHodScope(store, activityId, departmentId);
  const task = store.assignments.find(
    (t) => t.id === id && t.activityId === activityId && t.departmentId === departmentId,
  );
  if (!task?.purchasing)
    throw new Error('This purchasing task is not available in your department.');
  if (task.expenseId)
    throw new Error(
      'This task is linked to a submitted claim. Its details and purchase status are protected.',
    );
  if (task.purchasing.status === 'Cancelled') throw new Error('Cancelled tasks cannot be changed.');
  if (expected && expected !== task.purchasing.updatedAt)
    throw new Error(
      'This task changed since you opened it. Refresh and review the latest version.',
    );
  return task;
}
function validateInput(
  store: Store,
  activityId: string,
  departmentId: string,
  input: TaskInput,
  previous?: Assignment,
) {
  const data = projectHod(store);
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 120 ||
    typeof input.description !== 'string' ||
    !input.description.trim() ||
    input.description.length > 2000
  )
    throw new Error('Add an item name (up to 120 characters) and description (up to 2,000).');
  if (!Number.isSafeInteger(input.budget) || input.budget <= 0 || input.budget > 100_000_000_000)
    throw new Error('Item budget must be greater than zero with up to two decimal places.');
  if (!['Low', 'Medium', 'High'].includes(input.priority))
    throw new Error('Choose a valid priority.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
    Number.isNaN(Date.parse(input.dueDate)) ||
    new Date(input.dueDate).toISOString().slice(0, 10) !== input.dueDate
  )
    throw new Error('Choose a valid due date in YYYY-MM-DD format.');
  if (
    !store.directory?.memberships.some(
      (m) =>
        m.active &&
        m.userId === input.assigneeId &&
        m.activityId === activityId &&
        m.departmentId === departmentId,
    )
  )
    throw new Error('Assign this purchase to an eligible member of this department.');
  const summary = departmentBudget(data, activityId, departmentId);
  const room = summary.purchasingCapacity + (previous?.budget ?? 0);
  if (input.budget > room)
    throw new Error(
      `Insufficient department budget. This item must fit both the remaining planned allocation and funds available after recorded claims and open purchases. Maximum: ${(Math.max(0, room) / 100).toFixed(2)} ${data.settings.currency}.`,
    );
}
function record(store: Store, task: Assignment, action: string, before: unknown) {
  const actor = assertHodScope(store, task.activityId, task.departmentId);
  store.events.unshift({
    id: crypto.randomUUID(),
    activityId: task.activityId,
    departmentId: task.departmentId,
    assignmentId: task.id,
    actor: `${actor.name} · HOD demo`,
    action,
    detail: `Before: ${JSON.stringify(before)}. After: ${JSON.stringify(task)}.`,
    at: new Date().toISOString(),
  });
}
export function savePurchasingTask(
  source: Store,
  activityId: string,
  departmentId: string,
  input: TaskInput,
  id?: string,
  expected?: string,
) {
  const actor = assertHodScope(source, activityId, departmentId);
  const store = structuredClone(source);
  const previous = id ? editable(store, activityId, departmentId, id, expected) : undefined;
  validateInput(store, activityId, departmentId, input, previous);
  const before = previous ? structuredClone(previous) : null;
  const task: Assignment = previous ?? {
    id: crypto.randomUUID(),
    activityId,
    departmentId,
    budget: input.budget,
  };
  task.budget = input.budget;
  task.purchasing = {
    name: input.name.trim(),
    description: input.description.trim(),
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    priority: input.priority,
    status: previous?.purchasing?.status ?? 'Not Started',
    createdBy: previous?.purchasing?.createdBy ?? actor.userId,
    updatedAt: new Date().toISOString(),
  };
  if (!previous) store.assignments.unshift(task);
  record(store, task, previous ? 'Purchasing task updated' : 'Purchasing task created', before);
  return { store, taskId: task.id };
}
export function changePurchasingStatus(
  source: Store,
  activityId: string,
  departmentId: string,
  id: string,
  status: PurchasingStatus,
  expected?: string,
  cancel = false,
) {
  const store = structuredClone(source);
  const task = editable(store, activityId, departmentId, id, expected);
  if (
    cancel
      ? status !== 'Cancelled'
      : !nextPurchasingStates[task.purchasing!.status]?.includes(status)
  )
    throw new Error(
      'This purchasing status transition is not allowed. Claim and payment states are managed separately.',
    );
  const before = structuredClone(task);
  task.purchasing!.status = status;
  task.purchasing!.updatedAt = new Date().toISOString();
  record(store, task, cancel ? 'Purchasing task cancelled' : 'Purchase progress updated', before);
  return store;
}
