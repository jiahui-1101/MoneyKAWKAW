import { getDemoActor, requireRole } from '../domain/session';
import type { TaskInput } from '../domain/hod';
import type { PurchasingStatus, Store } from '../domain/models';
import { sharedRepository } from './director';
import { assertHodScope, projectHod } from './hod-access';
import { changePurchasingStatus, savePurchasingTask } from './hod-tasks';

async function readAuthorizedStore() {
  const actor = requireRole('HOD');
  const store = await sharedRepository.load();
  if (getDemoActor().userId !== actor.userId)
    throw new Error('Your demo session changed. Reload the workspace.');
  requireRole('HOD');
  return store;
}
let writing = false;
async function command(change: (store: Store) => { store: Store; taskId?: string }) {
  if (writing) throw new Error('A purchase is being saved. Please try again.');
  writing = true;
  try {
    const current = await readAuthorizedStore();
    const changed = change(current);
    const saved = await sharedRepository.save(changed.store);
    return { data: projectHod(saved), taskId: changed.taskId };
  } finally {
    writing = false;
  }
}
// No generic save endpoint is exposed to HOD views. Every command rechecks fresh membership.
export const hodService = {
  async load() {
    return projectHod(await readAuthorizedStore());
  },
  async department(activityId: string, departmentId: string) {
    const store = await readAuthorizedStore();
    assertHodScope(store, activityId, departmentId);
    const data = projectHod(store);
    return {
      ...data,
      scopes: data.scopes.filter(
        (s) => s.activity.id === activityId && s.department.id === departmentId,
      ),
      assignments: data.assignments.filter(
        (t) => t.activityId === activityId && t.departmentId === departmentId,
      ),
      expenses: data.expenses.filter(
        (e) => e.activityId === activityId && e.departmentId === departmentId,
      ),
      events: data.events.filter(
        (e) => e.activityId === activityId && e.departmentId === departmentId,
      ),
      payments: data.payments.filter((p) =>
        data.expenses.some(
          (e) =>
            e.id === p.expenseId && e.activityId === activityId && e.departmentId === departmentId,
        ),
      ),
      directory: {
        users: data.directory.users.filter((u) =>
          data.directory.memberships.some(
            (m) =>
              m.userId === u.id && m.activityId === activityId && m.departmentId === departmentId,
          ),
        ),
        memberships: data.directory.memberships.filter(
          (m) => m.activityId === activityId && m.departmentId === departmentId,
        ),
      },
    };
  },
  save(activityId: string, departmentId: string, input: TaskInput, id?: string, expected?: string) {
    return command((store) =>
      savePurchasingTask(store, activityId, departmentId, input, id, expected),
    );
  },
  transition(
    activityId: string,
    departmentId: string,
    id: string,
    status: PurchasingStatus,
    expected?: string,
  ) {
    return command((store) => ({
      store: changePurchasingStatus(store, activityId, departmentId, id, status, expected),
    }));
  },
  cancel(activityId: string, departmentId: string, id: string, expected?: string) {
    return command((store) => ({
      store: changePurchasingStatus(
        store,
        activityId,
        departmentId,
        id,
        'Cancelled',
        expected,
        true,
      ),
    }));
  },
};
