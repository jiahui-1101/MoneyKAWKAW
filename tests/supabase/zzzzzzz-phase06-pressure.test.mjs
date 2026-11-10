import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { admin, anonymous, signIn, syntheticEmails } from './helpers.mjs';
import { createFinancialClaim, ok } from './phase04-fixture.mjs';

test('pressure snapshots require independent current Treasurer grants and expose no personal data', async () => {
  const { claim, member } = await createFinancialClaim('Phase06 snapshot');
  const { client: treasurer, user } = await signIn(syntheticEmails.treasurer);
  const snapshot = (client) => client.rpc('claim_pressure_snapshot', { p_claim_id: claim.id });
  for (const email of [syntheticEmails.director, syntheticEmails.multimediaHod,
    syntheticEmails.multimediaMember, syntheticEmails.marketingMember, syntheticEmails.uninvited]) {
    assert.ok((await snapshot((await signIn(email)).client)).error);
  }
  assert.ok((await snapshot(anonymous)).error);
  const before = ok(await treasurer.rpc('financial_summaries'));
  const value = ok(await snapshot(treasurer));
  assert.equal(value.claimId, claim.id); assert.equal(value.revision, claim.revision);
  assert.equal(value.schema, 'budget-pressure-v1');
  assert.equal(value.raw.claim_sen, 11000); assert.equal(value.raw.estimate_sen, 8000);
  const finance = before.find((f) => f.departmentId === claim.department_id);
  assert.equal(value.raw.available_sen, finance.available);
  assert.equal(value.raw.pending_sen, finance.pending);
  assert.deepEqual(Object.keys(value).sort(), ['schema','claimId','revision','updatedAt','asOf','horizonEnd','raw'].sort());
  assert.equal(Object.keys(value.raw).length, 14);
  assert.ok(Object.values(value.raw).every(Number.isSafeInteger));
  assert.deepEqual(ok(await treasurer.rpc('financial_summaries')), before);
  assert.equal(ok(await member.from('claims').select('status').eq('id', claim.id).single()).status, 'Pending');
  // Browser inference/forged metadata has no accepted RPC argument or financial write privilege.
  assert.ok((await treasurer.rpc('transition_claim', { p_claim_id: claim.id, p_target: 'Approved',
    p_expected_updated_at: claim.updated_at, p_request_key: randomUUID(), p_reason: '', p_ml_score: 0 })).error);
  assert.ok((await member.from('claims').update({ approved_amount_sen: 1, risk_assessment: { score: 0 } }).eq('id', claim.id)).error);
  ok(await admin.from('club_role_grants').delete().eq('user_id', user.id).eq('role', 'Treasurer'));
  try { assert.ok((await snapshot(treasurer)).error); }
  finally { ok(await admin.from('club_role_grants').insert({ club_id: claim.club_id, user_id: user.id, role: 'Treasurer' })); }
  ok(await admin.from('club_role_grants').insert({ club_id: claim.club_id, user_id: claim.claimant_user_id, role: 'Treasurer' }));
  try { assert.ok((await snapshot(member)).error); }
  finally { ok(await admin.from('club_role_grants').delete().eq('user_id', claim.claimant_user_id).eq('role', 'Treasurer')); }
});

test('forged low predictions cannot approve a current budget deficit', async () => {
  const { claim, member } = await createFinancialClaim('Phase06 conflict', 500000);
  const { client: treasurer } = await signIn(syntheticEmails.treasurer);
  const transition = (c, target) => treasurer.rpc('transition_claim', { p_claim_id: c.id,
    p_target: target, p_expected_updated_at: c.updated_at, p_request_key: randomUUID(), p_reason: '' });
  ok(await transition(claim, 'Under Review'));
  const c = ok(await member.from('claims').select('*').eq('id', claim.id).single());
  const features = ok(await treasurer.rpc('claim_pressure_snapshot', { p_claim_id: c.id }));
  assert.ok(features.raw.available_sen < 0);
  const before = ok(await treasurer.rpc('financial_summaries'));
  assert.equal((await transition(c, 'Approved')).error?.code, '23514');
  assert.deepEqual(ok(await treasurer.rpc('financial_summaries')), before);
  assert.equal(ok(await member.from('claims').select('status').eq('id', c.id).single()).status, 'Under Review');
  assert.equal(ok(await member.from('reimbursement_payments').select('id').eq('claim_id', c.id)).length, 0);
});
