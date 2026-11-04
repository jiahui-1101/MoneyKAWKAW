import type { ClubDirectory, PurchasingDetails, Store } from '../domain/models';

const users = [
  { id: 'hod-sarah', name: 'Sarah Tan' },
  { id: 'hod-amir', name: 'Amir Hassan' },
  { id: 'hod-mei', name: 'Mei Wong' },
  { id: 'member-ava', name: 'Ava Chen' },
  { id: 'member-ryan', name: 'Ryan Lee' },
  { id: 'member-nadia', name: 'Nadia Aziz' },
  { id: 'member-daniel', name: 'Daniel Tan' },
  { id: 'member-grace', name: 'Grace Lim' },
];
const departmentAccess: Record<string, { hod: string; members: string[] }> = {
  'summit-programme': { hod: 'hod-sarah', members: ['member-ava', 'member-ryan'] },
  'dinner-programme': { hod: 'hod-sarah', members: ['member-nadia', 'member-ava'] },
  'summit-logistics': { hod: 'hod-amir', members: ['member-daniel', 'member-grace'] },
  'design-logistics': { hod: 'hod-amir', members: ['member-grace'] },
  'design-programme': { hod: 'hod-mei', members: ['member-ryan'] },
  'retreat-operations': { hod: 'hod-mei', members: ['member-nadia'] },
};

// Idempotent upgrade of version-1 Director data. No budgets, expenses, or payments change.
export function upgradeSharedStore(source: Store): Store {
  const store = structuredClone(source);
  if (store.directory) return store;
  const directory: ClubDirectory = { users: structuredClone(users), memberships: [] };
  for (const activity of store.activities)
    for (const department of activity.departments) {
      const access = departmentAccess[department.id];
      if (!access) continue;
      department.hodUserId = access.hod;
      directory.memberships.push({
        userId: access.hod,
        activityId: activity.id,
        departmentId: department.id,
        role: 'HOD',
        active: true,
      });
      for (const userId of access.members)
        directory.memberships.push({
          userId,
          activityId: activity.id,
          departmentId: department.id,
          role: 'Member',
          active: true,
        });
    }
  store.directory = directory;
  for (const task of store.assignments) {
    const activity = store.activities.find((a) => a.id === task.activityId)!;
    const access = departmentAccess[task.departmentId];
    const claim = store.expenses.find((e) => e.id === task.expenseId);
    const paid = store.payments
      .filter((p) => p.expenseId === claim?.id)
      .reduce((sum, p) => sum + p.amount, 0);
    task.purchasing = {
      name:
        claim?.description ?? (task.id === 'as-2' ? 'Workshop AV rental' : 'Awards certificates'),
      description: claim
        ? 'Fictional purchase linked to the shared sample expense record.'
        : 'Coordinate suppliers and purchase the required event materials.',
      assigneeId: task.id === 'as-3' ? null : (access?.members[0] ?? null),
      dueDate:
        task.id === 'as-2' ? '2026-11-02' : task.id === 'as-3' ? '2026-11-03' : activity.endDate,
      priority: 'Medium',
      status: claim
        ? paid >= claim.amount
          ? 'Completed'
          : 'Claim Submitted'
        : task.id === 'as-2'
          ? 'Purchased'
          : 'Not Started',
      createdBy: access?.hod ?? 'director-jamie',
      updatedAt: '2026-11-01T09:00:00+08:00',
    };
  }
  for (const expense of store.expenses.filter(
    (e) => !store.assignments.some((a) => a.expenseId === e.id),
  )) {
    const activity = store.activities.find((a) => a.id === expense.activityId)!;
    const access = departmentAccess[expense.departmentId];
    const paid = store.payments
      .filter((p) => p.expenseId === expense.id)
      .reduce((sum, p) => sum + p.amount, 0);
    store.assignments.push({
      id: `purchase-${expense.id}`,
      activityId: expense.activityId,
      departmentId: expense.departmentId,
      budget: expense.id === 'exp-2' ? 400_000 : expense.amount,
      expenseId: expense.id,
      purchasing: {
        name: expense.description,
        description:
          'Fictional purchase linked to the shared sample claim. Review and payment records are read-only.',
        assigneeId: access?.members[0] ?? null,
        dueDate: activity.endDate,
        priority: 'High',
        status: paid >= expense.amount ? 'Completed' : 'Claim Submitted',
        createdBy: access?.hod ?? 'director-jamie',
        updatedAt: `${expense.date}T09:00:00+08:00`,
      },
    });
  }
  for (const task of store.assignments.filter((t) => departmentAccess[t.departmentId])) {
    if (store.events.some((e) => e.id === `sample-plan-${task.id}`)) continue;
    store.events.push({
      id: `sample-plan-${task.id}`,
      activityId: task.activityId,
      departmentId: task.departmentId,
      assignmentId: task.id,
      action: 'Purchasing plan (sample)',
      actor: 'Fictional department history',
      detail: `${task.purchasing!.name} · item estimate ${(task.budget / 100).toFixed(2)} · ${task.expenseId ? `linked source ${task.expenseId}` : 'unclaimed purchasing plan'}.`,
      at: task.purchasing!.updatedAt,
    });
  }
  store.events.sort((a, b) => b.at.localeCompare(a.at));
  return store;
}

export function validatePurchasingData(store: Store) {
  const directory = store.directory;
  if (!directory || !Array.isArray(directory.users) || !Array.isArray(directory.memberships))
    throw new Error('Invalid membership directory.');
  if (
    new Set(directory.users.map((u) => u.id)).size !== directory.users.length ||
    directory.users.some((u) => !u.id || typeof u.name !== 'string')
  )
    throw new Error('Invalid directory users.');
  for (const m of directory.memberships) {
    if (
      !directory.users.some((u) => u.id === m.userId) ||
      !store.activities.some(
        (a) => a.id === m.activityId && a.departments.some((d) => d.id === m.departmentId),
      ) ||
      !['HOD', 'Member'].includes(m.role) ||
      typeof m.active !== 'boolean'
    )
      throw new Error('Invalid scoped membership.');
  }
  if (
    new Set(
      directory.memberships.map((m) => `${m.userId}:${m.activityId}:${m.departmentId}:${m.role}`),
    ).size !== directory.memberships.length
  )
    throw new Error('Duplicate scoped membership.');
  const linkedClaims = store.assignments.flatMap((t) => (t.expenseId ? [t.expenseId] : []));
  if (new Set(linkedClaims).size !== linkedClaims.length)
    throw new Error('A claim must be linked to only one purchasing task.');
  for (const task of store.assignments) {
    const p: PurchasingDetails | undefined = task.purchasing;
    const claim = store.expenses.find((e) => e.id === task.expenseId);
    if (claim?.review?.claimantId && claim.review.claimantId !== p?.assigneeId)
      throw new Error('The linked claimant must match the task assignee.');
    if (
      !p ||
      typeof p.createdBy !== 'string' ||
      !p.createdBy ||
      typeof p.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(p.updatedAt)) ||
      !p.name.trim() ||
      p.name.length > 120 ||
      !p.description.trim() ||
      p.description.length > 2000 ||
      !['Low', 'Medium', 'High'].includes(p.priority) ||
      ![
        'Not Started',
        'In Progress',
        'Purchased',
        'Claim Submitted',
        'Completed',
        'Cancelled',
      ].includes(p.status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ||
      Number.isNaN(Date.parse(p.dueDate)) ||
      new Date(p.dueDate).toISOString().slice(0, 10) !== p.dueDate
    )
      throw new Error('Invalid purchasing task details.');
    if (
      p.assigneeId &&
      !directory.memberships.some(
        (m) =>
          (m.active || !!task.expenseId || p.status === 'Cancelled') &&
          m.userId === p.assigneeId &&
          m.activityId === task.activityId &&
          m.departmentId === task.departmentId,
      )
    )
      throw new Error('A task assignee must belong to its department.');
    if (
      (p.status === 'Claim Submitted' && !task.expenseId) ||
      (!!task.expenseId && !['Claim Submitted', 'Completed'].includes(p.status))
    )
      throw new Error('Purchasing status conflicts with its claim record.');
  }
}
