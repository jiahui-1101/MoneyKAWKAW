import assert from 'node:assert/strict';
import test from 'node:test';
import { admin, signIn, syntheticEmails, userId } from './helpers.mjs';
import { loadWorkflow } from './business-fixture.mjs';

const taskInput = (activityId, departmentId, assignedMemberId, overrides = {}) => ({
  p_id: null, p_request_key: crypto.randomUUID(), p_activity_id: activityId,
  p_department_id: departmentId, p_item_name: 'HDMI Cable',
  p_description: 'Synthetic display connection for the venue',
  p_assigned_member_id: assignedMemberId, p_estimated_budget_sen: 8_000,
  p_due_date: '2026-12-20', p_priority: 'Medium', p_expected_updated_at: null,
  ...overrides,
});

test('HOD and Member share scoped purchasing tasks with audit history', async () => {
  const workflow = await loadWorkflow();
  const { client: hod } = await signIn(syntheticEmails.multimediaHod);
  const { client: member } = await signIn(syntheticEmails.multimediaMember);
  const { client: otherHod } = await signIn(syntheticEmails.marketingHod);
  const { client: otherMember } = await signIn(syntheticEmails.marketingMember);
  const memberId = await userId(syntheticEmails.multimediaMember);
  const marketingMemberId = await userId(syntheticEmails.marketingMember);
  assert.equal((await hod.from('departments').select('id').eq('id', workflow.multimediaId)).data.length, 1);
  assert.deepEqual((await hod.from('departments').select('id').eq('id', workflow.marketingId)).data, []);

  const input = taskInput(workflow.activityId, workflow.multimediaId, memberId);
  const created = await hod.rpc('save_purchase_task', input);
  assert.ifError(created.error);
  assert.equal(created.data.estimated_budget_sen, 8_000);
  assert.equal(created.data.status, 'Not Started');
  const replay = await hod.rpc('save_purchase_task', input);
  assert.ifError(replay.error);
  assert.equal(replay.data.id, created.data.id);
  const collision = await hod.rpc('save_purchase_task', { ...input, p_item_name: 'Different item' });
  assert.equal(collision.error?.code, '23505');

  const invalidBudget = await hod.rpc('save_purchase_task', { ...taskInput(workflow.activityId, workflow.multimediaId, memberId), p_estimated_budget_sen: -1 });
  assert.equal(invalidBudget.error?.code, '22023');
  const invalidAssignee = await hod.rpc('save_purchase_task', taskInput(workflow.activityId, workflow.multimediaId, marketingMemberId));
  assert.equal(invalidAssignee.error?.code, '42501');
  assert.equal((await otherHod.from('purchase_tasks').select('id').eq('id', created.data.id)).data.length, 0);
  assert.ok((await hod.from('activities').update({ budget_sen: 2_000_000 }).eq('id', workflow.activityId)).error);
  assert.ok((await hod.from('departments').update({ allocation_sen: 999_999 }).eq('id', workflow.multimediaId)).error);

  const visible = await member.from('purchase_tasks').select('id,item_name,estimated_budget_sen,status,due_date').eq('id', created.data.id).single();
  assert.ifError(visible.error);
  assert.equal(visible.data.item_name, 'HDMI Cable');
  assert.equal(visible.data.due_date, '2026-12-20');
  assert.equal((await member.from('profiles').select('user_id')).data.length, 2);
  assert.deepEqual((await member.from('departments').select('id').eq('id', workflow.marketingId)).data, []);
  assert.ok((await member.from('purchase_tasks').update({ estimated_budget_sen: 90_000 }).eq('id', created.data.id)).error);
  assert.ok((await member.from('activities').update({ budget_sen: 2_000_000 }).eq('id', workflow.activityId)).error);

  const changed = await member.rpc('update_my_purchase_progress', {
    p_task_id: created.data.id, p_status: 'In Progress', p_expected_updated_at: created.data.updated_at,
  });
  assert.ifError(changed.error);
  assert.equal(changed.data.status, 'In Progress');
  const stale = await member.rpc('update_my_purchase_progress', {
    p_task_id: created.data.id, p_status: 'Purchased', p_expected_updated_at: created.data.updated_at,
  });
  assert.equal(stale.error?.code, 'PT409');
  assert.equal((await hod.from('purchase_tasks').select('status').eq('id', created.data.id).single()).data.status, 'In Progress');
  assert.ok((await otherMember.rpc('update_my_purchase_progress', {
    p_task_id: created.data.id, p_status: 'Purchased', p_expected_updated_at: changed.data.updated_at,
  })).error);
  assert.ok((await otherHod.rpc('update_hod_purchase_task_status', {
    p_task_id: created.data.id, p_status: 'Completed', p_expected_updated_at: changed.data.updated_at,
  })).error);
  assert.ok((await member.from('audit_events').update({ action: 'forged' }).eq('record_id', created.data.id)).error);
  const events = await admin.from('audit_events').select('action').eq('record_id', created.data.id);
  assert.ifError(events.error);
  assert.ok(events.data.some((event) => event.action === 'Purchasing task created'));
  assert.ok(events.data.some((event) => event.action === 'Member purchase progress updated'));
});

test('concurrent HOD reservations cannot exceed allocation and cancellation releases commitment', async () => {
  const workflow = await loadWorkflow();
  const { client: hod } = await signIn(syntheticEmails.multimediaHod);
  const memberId = await userId(syntheticEmails.multimediaMember);
  const requests = [100_000, 100_000].map((amount, index) => taskInput(
    workflow.activityId, workflow.multimediaId, memberId,
    { p_request_key: crypto.randomUUID(), p_item_name: `Concurrent item ${index + 1}`, p_estimated_budget_sen: amount },
  ));
  const results = await Promise.all(requests.map((input) => hod.rpc('save_purchase_task', input)));
  assert.equal(results.filter((result) => !result.error).length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  const activeBefore = await admin.from('purchase_tasks').select('id,estimated_budget_sen,status').eq('department_id', workflow.multimediaId).neq('status', 'Cancelled');
  assert.ifError(activeBefore.error);
  const committedBefore = activeBefore.data.reduce((sum, task) => sum + task.estimated_budget_sen, 0);
  assert.ok(committedBefore <= 200_000);
  const winner = results.find((result) => !result.error).data;
  const cancelled = await hod.rpc('update_hod_purchase_task_status', {
    p_task_id: winner.id, p_status: 'Cancelled', p_expected_updated_at: winner.updated_at,
  });
  assert.ifError(cancelled.error);
  const activeAfter = await admin.from('purchase_tasks').select('estimated_budget_sen,status').eq('department_id', workflow.multimediaId).neq('status', 'Cancelled');
  assert.ifError(activeAfter.error);
  assert.equal(activeAfter.data.reduce((sum, task) => sum + task.estimated_budget_sen, 0), 8_000);
});
