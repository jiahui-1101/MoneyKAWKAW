import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { admin } from './helpers.mjs';
import { ok } from './phase04-fixture.mjs';
import { archiveFixture, archiveClaim, transition } from './phase08-fixture.mjs';

test('closing serializes with purchase creation and requires resolution of a rejected task', async () => {
  const f = await archiveFixture('Phase 08 rejected purchase resolution');
  const { claim, task } = await archiveClaim(f);
  await transition(f, claim.id, 'Under Review');
  await transition(f, claim.id, 'Rejected', 'Synthetic expense does not qualify.');
  const save = (name) => f.hod.rpc('save_purchase_task', {
    p_id: null, p_request_key: randomUUID(), p_activity_id: f.activityId, p_department_id: f.multimediaId,
    p_item_name: name, p_description: 'Synthetic concurrent task', p_assigned_member_id: f.memberId,
    p_estimated_budget_sen: 1000, p_due_date: '2026-12-20', p_priority: 'Medium', p_expected_updated_at: null,
  });
  const alreadyOpen = ok(await save('Unfinished purchase'));
  const purchased = ok(await save('Purchased outside reimbursement'));
  ok(await f.member.rpc('update_my_purchase_progress', {
    p_task_id: purchased.id, p_status: 'Purchased', p_expected_updated_at: purchased.updated_at,
  }));
  const [write, close] = await Promise.all([save('Racing new task'),
    f.director.rpc('request_activity_close', { p_activity: f.activityId })]);
  ok(close);
  if (write.error) assert.ok(['23514', '55P03'].includes(write.error.code));
  const read = async () => ok(await f.treasurer.rpc('activity_closing_readiness', { p_activity: f.activityId, p_role: 'Treasurer' }));
  assert.equal((await read()).blockers.unresolvedTasks, write.data ? 4 : 3);
  assert.equal((await save('No new purchases during closing')).error?.code, '23514');
  assert.equal((await f.member.rpc('begin_my_claim', { p_task_id: purchased.id, p_request_key: randomUUID() })).error?.code, '23514');
  for (const unfinished of [alreadyOpen, write.data].filter(Boolean))
    ok(await f.hod.rpc('update_hod_purchase_task_status', {
      p_task_id: unfinished.id, p_status: 'Cancelled', p_expected_updated_at: unfinished.updated_at,
    }));
  const reason = 'No outstanding reimbursement for this synthetic task.';
  for (const purchase of [task, purchased])
    ok(await f.hod.rpc('resolve_closing_purchase', { p_task: purchase.id, p_reason: reason }));
  const reconciled = await read();
  assert.equal(reconciled.blockers.unresolvedTasks, 0);
  assert.equal(reconciled.reserved, 0);
  assert.equal(reconciled.paid, 0);
  assert.equal(reconciled.claimStates.Rejected, 1);
  assert.equal(ok(await f.member.from('claims').select('status').eq('id', claim.id).single()).status, 'Rejected');
  ok(await f.director.rpc('reopen_activity_closing', {
    p_activity: f.activityId, p_revision: reconciled.revision, p_reason: 'Synthetic correction check.',
  }));
  assert.equal((await f.member.rpc('begin_my_claim', { p_task_id: purchased.id, p_request_key: randomUUID() })).error?.code, '23514');
});

test('activity closing denies other clubs and empty role arguments', async () => {
  const f = await archiveFixture('Phase 08 club scope');
  const club = ok(await admin.from('clubs').insert({ slug: 'archive-scope-' + randomUUID(), name: 'Synthetic separate club' }).select('id').single());
  const activity = ok(await admin.from('activities').insert({
    club_id: club.id, name: 'Separate club activity', type: 'Workshop', status: 'Active',
    start_date: '2026-11-01', end_date: '2026-12-31', budget_sen: 1000,
  }).select('id').single());
  assert.equal((await f.director.rpc('request_activity_close', { p_activity: activity.id })).error?.code, '42501');
  assert.equal((await f.treasurer.rpc('activity_closing_report', { p_activity: activity.id, p_role: 'Treasurer' })).error?.code, '42501');
  assert.equal((await f.director.rpc('activity_closing_report', { p_activity: f.activityId, p_role: null })).error?.code, '42501');
});
