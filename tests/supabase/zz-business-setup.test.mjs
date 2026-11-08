import assert from 'node:assert/strict';
import test from 'node:test';
import { signIn, syntheticEmails, userId } from './helpers.mjs';

test('Director persists activity, allocations, and scoped assignments', async () => {
  const { client } = await signIn(syntheticEmails.director);
  const input = {
    p_id: null, p_name: 'Annual Dinner', p_description: 'Synthetic procurement test',
    p_type: 'Small Event', p_status: 'Active', p_start_date: '2026-11-01',
    p_end_date: '2026-12-31', p_budget_sen: 1_000_000,
  };
  const created = await client.rpc('save_activity', input);
  assert.ifError(created.error);
  assert.equal(created.data.name, 'Annual Dinner');
  assert.equal(created.data.budget_sen, 1_000_000);

  const invalid = await client.rpc('save_activity', { ...input, p_id: created.data.id, p_budget_sen: -1 });
  assert.equal(invalid.error?.code, '22023');
  const hod = await signIn(syntheticEmails.multimediaHod);
  assert.equal((await hod.client.rpc('save_activity', input)).error?.code, '42501');

  const mmHod = await userId(syntheticEmails.multimediaHod);
  const mmMember = await userId(syntheticEmails.multimediaMember);
  const marketingHod = await userId(syntheticEmails.marketingHod);
  const marketingMember = await userId(syntheticEmails.marketingMember);
  const saveDepartment = (name, allocation, hodUserId, memberUserIds) => client.rpc('save_department_setup', {
    p_activity_id: created.data.id, p_department_id: null, p_name: name,
    p_description: `${name} procurement team`, p_head_label: '',
    p_allocation_sen: allocation, p_hod_user_id: hodUserId, p_member_user_ids: memberUserIds,
  });
  const multimedia = await saveDepartment('Multimedia', 200_000, mmHod, [mmMember]);
  assert.ifError(multimedia.error);
  const marketing = await saveDepartment('Marketing', 100_000, marketingHod, [marketingMember]);
  assert.ifError(marketing.error);
  assert.ok(multimedia.data);
  assert.ok(marketing.data);

  const edited = await client.rpc('save_activity', { ...input, p_id: created.data.id, p_description: 'Edited synthetic procurement activity' });
  assert.ifError(edited.error);

  const belowAllocation = await client.rpc('save_activity', { ...input, p_id: created.data.id, p_budget_sen: 299_999 });
  assert.equal(belowAllocation.error?.code, '23514');
  const overAllocation = await saveDepartment('Over budget', 800_001, null, []);
  assert.equal(overAllocation.error?.code, '23514');
  const saved = await client.from('activities').select('name,description,budget_sen').eq('id', created.data.id).single();
  assert.ifError(saved.error);
  assert.equal(saved.data.name, 'Annual Dinner');
  assert.equal(saved.data.description, 'Edited synthetic procurement activity');
  assert.equal(saved.data.budget_sen, 1_000_000);
  const audit = await client.from('audit_events').select('action').eq('activity_id', created.data.id);
  assert.ifError(audit.error);
  assert.ok(audit.data.some((event) => event.action === 'Activity created'));
  assert.ok(audit.data.some((event) => event.action === 'Department budget changed'));
});

test('uninvited users cannot invoke Director operations', async () => {
  const { client } = await signIn(syntheticEmails.uninvited);
  const result = await client.rpc('save_activity', {
    p_id: null, p_name: 'Unauthorized', p_description: 'Should not persist',
    p_type: 'Workshop', p_status: 'Planning', p_start_date: '2026-11-01',
    p_end_date: '2026-12-31', p_budget_sen: 100_000,
  });
  assert.equal(result.error?.code, '42501');
  assert.equal((await client.from('activities').select('id')).data.length, 0);
});
