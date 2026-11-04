import type { Store } from '../domain/models';
import { requireRole } from '../domain/session';
import { upgradeSharedStore } from './shared-migration';

export function configureDepartmentAccess(
  source: Store,
  activityId: string,
  departmentId: string,
  hodId: string,
  memberIds: string[],
) {
  requireRole('Director');
  const store = upgradeSharedStore(source);
  const directory = store.directory!;
  const department = store.activities
    .find((a) => a.id === activityId)
    ?.departments.find((d) => d.id === departmentId);
  if (!department) throw new Error('Department not found.');
  const ids = new Set([...memberIds, ...(hodId ? [hodId] : [])]);
  if ([...ids].some((id) => !directory.users.some((u) => u.id === id)))
    throw new Error('Choose people from the club directory.');
  // Preserve historical memberships for claim owners, but revoke management and new-task eligibility.
  const oldMembers = directory.memberships.filter(
    (m) => m.activityId === activityId && m.departmentId === departmentId,
  );
  const removed = oldMembers.filter((m) => !ids.has(m.userId));
  if (
    removed.some((m) =>
      store.assignments.some(
        (t) =>
          t.activityId === activityId &&
          t.departmentId === departmentId &&
          t.purchasing?.assigneeId === m.userId &&
          !t.expenseId &&
          t.purchasing?.status !== 'Cancelled',
      ),
    )
  )
    throw new Error('Reassign or cancel open purchases before removing a department member.');
  directory.memberships = directory.memberships.filter(
    (m) => m.activityId !== activityId || m.departmentId !== departmentId,
  );
  for (const userId of ids)
    directory.memberships.push({
      userId,
      activityId,
      departmentId,
      role: userId === hodId ? 'HOD' : 'Member',
      active: true,
    });
  for (const m of removed) directory.memberships.push({ ...m, active: false });
  const before = department.hodUserId ?? 'Unassigned';
  department.hodUserId = hodId || undefined;
  if (hodId) department.head = directory.users.find((u) => u.id === hodId)!.name;
  if (
    before !== (hodId || 'Unassigned') ||
    JSON.stringify(
      oldMembers
        .filter((m) => m.active)
        .map((m) => m.userId)
        .sort(),
    ) !== JSON.stringify([...ids].sort())
  )
    store.events.unshift({
      id: crypto.randomUUID(),
      activityId,
      departmentId,
      action: 'Department access updated',
      detail: `HOD: ${before} → ${hodId || 'Unassigned'}. Eligible people: ${[...ids].join(', ') || 'None'}.`,
      actor: 'Director · demo',
      at: new Date().toISOString(),
    });
  return store;
}
