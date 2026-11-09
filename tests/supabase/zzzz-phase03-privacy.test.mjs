import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { admin, anonymous, signIn, syntheticEmails, userId } from './helpers.mjs';
import { loadWorkflow } from './business-fixture.mjs';

test('draft claims and payment account audit stay private across roles', async () => {
  const workflow = await loadWorkflow();
  const [hod, member, anotherMember, treasurer, director] = await Promise.all([
    signIn(syntheticEmails.multimediaHod), signIn(syntheticEmails.multimediaMember),
    signIn(syntheticEmails.marketingMember), signIn(syntheticEmails.treasurer), signIn(syntheticEmails.director),
  ]);
  const assignedMember = await userId(syntheticEmails.multimediaMember);
  const created = await hod.client.rpc('save_purchase_task', {
    p_id: null, p_request_key: randomUUID(), p_activity_id: workflow.activityId,
    p_department_id: workflow.multimediaId, p_item_name: 'Private receipt workflow',
    p_description: 'Synthetic access-control test', p_assigned_member_id: assignedMember,
    p_estimated_budget_sen: 5_000, p_due_date: '2026-12-20', p_priority: 'Low', p_expected_updated_at: null,
  });
  assert.ifError(created.error);
  let progress = await member.client.rpc('update_my_purchase_progress', {
    p_task_id: created.data.id, p_status: 'In Progress', p_expected_updated_at: created.data.updated_at,
  });
  assert.ifError(progress.error);
  progress = await member.client.rpc('update_my_purchase_progress', {
    p_task_id: created.data.id, p_status: 'Purchased', p_expected_updated_at: progress.data.updated_at,
  });
  assert.ifError(progress.error);

  const account = await member.client.rpc('save_my_payment_account', {
    p_account_id: null, p_expected_updated_at: null, p_label: 'Synthetic primary', p_kind: 'Bank',
    p_holder: 'Synthetic Member', p_institution: 'Test Bank', p_identifier: '1234567890', p_is_default: true,
  });
  assert.ifError(account.error);
  assert.ok((await member.client.from('audit_events').select('id').eq('record_type', 'payment_account')
    .eq('record_id', account.data)).data.length);
  for (const outsider of [anotherMember.client, hod.client, treasurer.client, director.client]) {
    assert.deepEqual((await outsider.from('audit_events').select('id').eq('record_type', 'payment_account')
      .eq('record_id', account.data)).data, []);
    assert.deepEqual((await outsider.rpc('list_my_payment_accounts')).data, []);
  }
  assert.ok((await member.client.from('payment_accounts').select('identifier')).error);

  const draft = await member.client.rpc('begin_my_claim', { p_task_id: created.data.id, p_request_key: randomUUID() });
  assert.ifError(draft.error);
  assert.equal((await member.client.from('claims').select('id').eq('id', draft.data)).data.length, 1);
  assert.equal((await member.client.from('audit_events').select('id').eq('record_type', 'claim')
    .eq('record_id', draft.data)).data.length, 1);
  for (const outsider of [anotherMember.client, hod.client, treasurer.client, director.client]) {
    assert.deepEqual((await outsider.from('claims').select('id').eq('id', draft.data)).data, []);
    assert.deepEqual((await outsider.from('audit_events').select('id').eq('record_type', 'claim')
      .eq('record_id', draft.data)).data, []);
  }
  assert.ok((await member.client.from('claims').update({ status: 'Pending' }).eq('id', draft.data)).error);
  assert.ok((await member.client.from('claim_receipts').insert({ claim_id: draft.data })).error);
  assert.ok((await anonymous.from('claims').select('id')).error);
  assert.ok((await anonymous.rpc('begin_my_claim', { p_task_id: created.data.id, p_request_key: randomUUID() })).error);
  assert.ok((await admin.from('claims').select('id').eq('id', draft.data)).data.length);
});
