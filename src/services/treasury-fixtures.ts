import type { Store } from '../domain/models';
import { departmentToday } from '../domain/hod';
import { sharedRepository } from './director';
import {
  assertActivity,
  projectTreasury,
  treasuryEvent,
  treasuryRead,
  treasuryWrite,
} from './treasury-core';
import { sampleEvidence } from './treasury-migration';

export function fixtureTasks(store: Store) {
  return store.assignments.filter(
    (t) => !t.expenseId && t.purchasing?.assigneeId && t.purchasing.status !== 'Cancelled',
  );
}
// Explicit test-data loader, not a member submission or a payment destination editor.
export function loadDemoClaim(taskId: string, amount: number, justification: string) {
  return treasuryWrite(async () => {
    const { store } = await treasuryRead();
    const task = fixtureTasks(store).find((t) => t.id === taskId);
    if (!task) throw new Error('Choose an assigned task without an existing claim.');
    assertActivity(store, task.activityId);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000_000)
      throw new Error('Enter a valid positive claim amount.');
    if (justification.length > 1000 || (amount > task.budget && !justification.trim()))
      throw new Error('Explain the over-budget amount (up to 1,000 characters).');
    const p = task.purchasing!;
    const at = new Date().toISOString();
    const id = `demo-${crypto.randomUUID()}`;
    const claimantId = p.assigneeId!;
    if (
      !store.directory?.memberships.some(
        (m) =>
          m.active &&
          m.role === 'Member' &&
          m.userId === claimantId &&
          m.activityId === task.activityId &&
          m.departmentId === task.departmentId,
      )
    )
      throw new Error('The task assignee must still be an active department member.');
    store.expenses.push({
      id,
      activityId: task.activityId,
      departmentId: task.departmentId,
      description: p.name,
      amount,
      date: departmentToday(store.settings.timezone),
      state: 'Pending review',
      review: {
        claimantId,
        submittedAt: at,
        updatedAt: at,
        justification: justification.trim() || 'Fictional fixture within item budget.',
      },
    });
    task.expenseId = id;
    p.status = 'Claim Submitted';
    p.updatedAt = at;
    store.treasury!.receipts.push(sampleEvidence(id, p.name, amount, at));
    store.treasury!.payouts.push({
      expenseId: id,
      ownerId: claimantId,
      kind: 'Bank',
      label: 'Fictional demo destination · not payable',
      holder: store.directory!.users.find((u) => u.id === claimantId)!.name,
      institution: 'Demo bank (not a financial institution)',
      identifier: `DEMO-NOT-PAYABLE-${id}`,
      masked: 'DEMO •••• TEST',
    });
    treasuryEvent(
      store,
      id,
      'Fictional claim fixture loaded',
      `Task ${task.id} · sample evidence and fictional destination. No member submission was performed.`,
    );
    await sharedRepository.save(store);
    return { data: projectTreasury(store), claimId: id };
  });
}
