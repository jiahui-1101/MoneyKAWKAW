import type { Store } from '../domain/models';
import { getDemoActor, requireRole } from '../domain/session';
import { sharedRepository } from './director';

export async function treasuryRead() {
  const actor = requireRole('Treasurer');
  const store = await sharedRepository.load();
  if (getDemoActor().userId !== actor.userId)
    throw new Error('Demo profile changed. Refresh your workspace.');
  requireRole('Treasurer');
  return { store, actor };
}
export function assertActivity(store: Store, activityId: string) {
  const actor = requireRole('Treasurer');
  if (!store.treasury?.grants.some((g) => g.userId === actor.userId && g.activityId === activityId))
    throw new Error('This activity is outside your Treasurer oversight.');
}
export function scopedClaim(store: Store, claimId: string) {
  const claim = store.expenses.find((e) => e.id === claimId);
  if (!claim) throw new Error('Claim unavailable in your Treasurer scope.');
  assertActivity(store, claim.activityId);
  return claim;
}
export function projectTreasury(store: Store): Store {
  const ids = new Set(
    store
      .treasury!.grants.filter((g) => g.userId === getDemoActor().userId)
      .map((g) => g.activityId),
  );
  const expenses = store.expenses.filter((e) => ids.has(e.activityId));
  const members = new Set([
    ...expenses.map((e) => e.review?.claimantId),
    ...store.assignments.filter((t) => ids.has(t.activityId)).map((t) => t.purchasing?.assigneeId),
  ]);
  return {
    ...store,
    member: undefined,
    activities: store.activities.filter((a) => ids.has(a.id)),
    expenses,
    assignments: store.assignments.filter((t) => ids.has(t.activityId)),
    events: store.events.filter((e) => ids.has(e.activityId)),
    payments: store.payments
      .filter((p) => expenses.some((e) => e.id === p.expenseId))
      .map((p) => ({
        ...p,
        manual: p.manual ? { ...p.manual, proof: { ...p.manual.proof, dataUrl: '' } } : undefined,
      })),
    directory: store.directory
      ? { users: store.directory.users.filter((u) => members.has(u.id)), memberships: [] }
      : undefined,
    treasury: {
      ...store.treasury!,
      grants: store.treasury!.grants.filter((g) => g.userId === getDemoActor().userId),
      receipts: [],
      payouts: [],
    },
  };
}
export function treasuryEvent(store: Store, claimId: string, action: string, detail: string) {
  const claim = scopedClaim(store, claimId);
  store.events.unshift({
    id: crypto.randomUUID(),
    activityId: claim.activityId,
    departmentId: claim.departmentId,
    assignmentId: store.assignments.find((t) => t.expenseId === claimId)?.id,
    action,
    detail: `${claimId} · ${detail}`,
    actor: getDemoActor().name,
    at: new Date().toISOString(),
  });
}
// Serialize local commands across tabs where Web Locks are available. APIs must repeat these checks.
let queue = Promise.resolve();
export async function treasuryWrite<T>(operation: () => Promise<T>): Promise<T> {
  const actor = requireRole('Treasurer');
  const authorized = () => {
    if (getDemoActor().userId !== actor.userId) throw new Error('Demo profile changed.');
    return operation();
  };
  const perform = async (): Promise<T> =>
    typeof navigator !== 'undefined' && navigator.locks
      ? await navigator.locks.request('moneykawkaw-ledger', authorized)
      : await authorized();
  const next = queue.then(perform, perform);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
