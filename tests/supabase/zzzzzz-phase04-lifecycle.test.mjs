import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { admin, anonymous, signIn, syntheticEmails } from './helpers.mjs';
import { createFinancialClaim } from './phase04-fixture.mjs';
import { archiveFixture } from './phase08-fixture.mjs';
const ok = (r) => { assert.ifError(r.error); return r.data; };
const row = async (client,id) => ok(await client.from('claims').select('*').eq('id',id).single());

test('conflicting review requests complete with one decision and a nonretryable HTTP conflict', async () => {
  const workflow = await archiveFixture('Synthetic isolated review conflict');
  const { claim } = await createFinancialClaim('Synthetic bounded review conflict', 1000, 1000, workflow);
  const { client: treasurer } = await signIn(syntheticEmails.treasurer);
  const reviewed = ok(await treasurer.rpc('transition_claim', {
    p_claim_id: claim.id, p_target: 'Under Review', p_expected_updated_at: claim.updated_at,
    p_request_key: randomUUID(), p_reason: 'Synthetic independent review',
  }));
  const started = performance.now();
  const attempts = await Promise.all(['Approved', 'Rejected'].map(target => treasurer.rpc('transition_claim', {
    p_claim_id: claim.id, p_target: target, p_expected_updated_at: reviewed,
    p_request_key: randomUUID(), p_reason: 'Synthetic conflicting decision',
  }).abortSignal(AbortSignal.timeout(10_000))));
  assert.equal(attempts.filter(result => !result.error).length, 1);
  const conflict = attempts.find(result => result.error);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.error.code, 'PT409');
  assert.ok(performance.now() - started < 10_000);
  const current = await row(treasurer, claim.id);
  assert.ok(['Approved', 'Rejected'].includes(current.status));
  const decisions = ok(await treasurer.from('claim_status_history').select('id')
    .eq('claim_id', claim.id).in('to_status', ['Approved', 'Rejected']));
  assert.equal(decisions.length, 1);
});

test('Phase 04 enforces independent review, exact payment and receipt confirmation', async () => {
  const {client:treasurer,user:treasUser}=await signIn(syntheticEmails.treasurer);
  const {client:member,user:memberUser}=await signIn(syntheticEmails.multimediaMember);
  const {client:hod}=await signIn(syntheticEmails.multimediaHod);
  const {client:other}=await signIn(syntheticEmails.marketingMember);
  const {client:uninvited}=await signIn(syntheticEmails.uninvited);
  const task=ok(await admin.from('purchase_tasks').select('*').eq('item_name','Synthetic HDMI adapter').single());
  const c=ok(await treasurer.from('claims').select('*').eq('purchase_task_id',task.id).single());
  const call=(client,target,expected,key=randomUUID(),reason='')=>client.rpc('transition_claim',{
    p_claim_id:c.id,p_target:target,p_expected_updated_at:expected,p_request_key:key,p_reason:reason});
  for (const client of [member,hod,other,uninvited,anonymous]) assert.ok((await call(client,'Under Review',c.updated_at)).error);
  assert.ok((await call(treasurer,'Approved',c.updated_at)).error);
  ok(await admin.from('club_role_grants').insert({club_id:c.club_id,user_id:memberUser.id,role:'Treasurer'}));
  try {
    assert.equal((await call(member,'Under Review',c.updated_at)).error?.code,'42501');
    assert.ok((await member.rpc('payment_instructions',{p_claim_id:c.id})).error);
  } finally { ok(await admin.from('club_role_grants').delete().eq('club_id',c.club_id).eq('user_id',memberUser.id).eq('role','Treasurer')); }
  ok(await admin.from('club_role_grants').delete().eq('user_id',treasUser.id).eq('role','Treasurer'));
  assert.equal((await call(treasurer,'Under Review',c.updated_at)).error?.code,'42501');
  ok(await admin.from('club_role_grants').insert({club_id:c.club_id,user_id:treasUser.id,role:'Treasurer'}));
  const startKey=randomUUID();
  const reviewed=ok(await call(treasurer,'Under Review',c.updated_at,startKey));
  ok(await admin.from('club_role_grants').insert({club_id:c.club_id,user_id:memberUser.id,role:'Treasurer'}));
  try {
    assert.equal((await call(member,'Approved',reviewed)).error?.code,'42501');
  } finally { ok(await admin.from('club_role_grants').delete().eq('club_id',c.club_id).eq('user_id',memberUser.id).eq('role','Treasurer')); }
  assert.equal(ok(await call(treasurer,'Under Review',c.updated_at,startKey)),reviewed);
  const stale = await call(treasurer,'Approved',c.updated_at);
  assert.equal(stale.error?.code,'PT409');
  assert.equal(stale.status,409);
  assert.ok((await call(treasurer,'Rejected',reviewed,randomUUID(),'')).error);
  const risk=ok(await treasurer.rpc('assess_claim_risk',{p_claim_id:c.id}));
  assert.equal(risk.variance,500); assert.equal(risk.variancePercent,12.5);
  const approved=ok(await call(treasurer,'Approved',reviewed));
  assert.equal((await row(member,c.id)).approved_amount_sen,4500);
  let summary=ok(await treasurer.rpc('financial_summaries')).find(r=>r.departmentId===c.department_id);
  assert.equal(summary.liability,4500); assert.equal(summary.paid,0); assert.equal(summary.pending,0);
  const instructions=ok(await treasurer.rpc('payment_instructions',{p_claim_id:c.id}))[0];
  assert.equal(instructions.identifier,'9876543210');
  assert.ok((await member.rpc('payment_instructions',{p_claim_id:c.id})).error);
  const pending=ok(await call(treasurer,'Payment Pending',approved));
  const receipt=ok(await treasurer.from('claim_receipts').select('*').eq('claim_id',c.id).eq('is_current',true).single());
  const bytes=Buffer.from(await ok(await member.storage.from('receipts').download(receipt.storage_path)).arrayBuffer());
  const proof=ok(await treasurer.rpc('prepare_payment_proof',{p_claim_id:c.id,p_filename:'synthetic-proof.png',p_mime:'image/png',p_size:bytes.length,p_sha256:receipt.sha256}));
  assert.ok((await other.storage.from('payment-proofs').upload(proof.storage_path,bytes,{contentType:'image/png'})).error);
  ok(await treasurer.storage.from('payment-proofs').upload(proof.storage_path,bytes,{contentType:'image/png'}));
  ok(await treasurer.rpc('finalize_payment_proof',{p_proof_id:proof.id}));
  assert.ok((await treasurer.storage.from('payment-proofs').upload(proof.storage_path,bytes,{contentType:'image/png',upsert:true})).error);
  const args={p_claim_id:c.id,p_expected_updated_at:pending,p_request_key:randomUUID(),p_amount_sen:4500,
    p_payment_date:new Date().toISOString().slice(0,10),p_reference:'SYNTHETIC-PHASE04-ONLY',p_proof_id:proof.id,
    p_destination_revision:instructions.revision,p_confirmed:true};
  ok(await admin.from('club_role_grants').insert({club_id:c.club_id,user_id:memberUser.id,role:'Treasurer'}));
  try {
    assert.equal((await member.rpc('payment_instructions',{p_claim_id:c.id})).error?.code,'42501');
    assert.equal((await member.rpc('record_reimbursement',args)).error?.code,'42501');
  } finally { ok(await admin.from('club_role_grants').delete().eq('club_id',c.club_id).eq('user_id',memberUser.id).eq('role','Treasurer')); }
  assert.ok((await treasurer.rpc('record_reimbursement',{...args,p_amount_sen:4000})).error);
  assert.ok((await treasurer.rpc('record_reimbursement',{...args,p_reference:''})).error);
  assert.ok((await treasurer.rpc('record_reimbursement',{...args,p_proof_id:randomUUID()})).error);
  assert.equal((await row(member,c.id)).status,'Payment Pending');
  const attempts=await Promise.all([treasurer.rpc('record_reimbursement',args),treasurer.rpc('record_reimbursement',args)]);
  attempts.forEach(r=>assert.ifError(r.error)); assert.equal(attempts[0].data,attempts[1].data);
  const paymentId=attempts[0].data;
  assert.ok((await treasurer.rpc('record_reimbursement',{...args,p_request_key:randomUUID()})).error);
  assert.equal(ok(await treasurer.from('reimbursement_payments').select('id').eq('claim_id',c.id)).length,1);
  assert.ok((await other.storage.from('payment-proofs').createSignedUrl(proof.storage_path,60)).error);
  assert.ok(ok(await member.storage.from('payment-proofs').createSignedUrl(proof.storage_path,60)).signedUrl);
  assert.equal(ok(await treasurer.storage.from('payment-proofs').remove([proof.storage_path])).length,0);
  assert.ok((await member.from('claims').update({status:'Received'}).eq('id',c.id)).error);
  assert.ok((await call(treasurer,'Received',(await row(treasurer,c.id)).updated_at)).error);
  assert.ok((await call(other,'Received',(await row(member,c.id)).updated_at)).error);
  ok(await member.rpc('report_payment_issue',{p_payment_id:paymentId,p_request_key:randomUUID(),p_reason:'Synthetic receipt verification question',p_received_sen:0}));
  const paid=await row(member,c.id);
  assert.ok((await call(member,'Received',paid.updated_at)).error);
  ok(await treasurer.rpc('resolve_payment_issue',{p_payment_id:paymentId,p_request_key:randomUUID(),p_note:'Synthetic issue resolved; claimant must confirm independently.'}));
  const receivedKey=randomUUID();
  ok(await call(member,'Received',paid.updated_at,receivedKey));
  ok(await call(member,'Received',paid.updated_at,receivedKey));
  assert.equal((await row(member,c.id)).status,'Received');
  summary=ok(await treasurer.rpc('financial_summaries')).find(r=>r.departmentId===c.department_id);
  assert.equal(summary.liability,0); assert.equal(summary.paid,4500);
  assert.equal(ok(await member.from('claim_status_history').select('id').eq('claim_id',c.id).eq('to_status','Received')).length,1);
  assert.ok(ok(await member.from('financial_notifications').select('id').eq('claim_id',c.id)).length>=5);
  assert.deepEqual((await other.from('reimbursement_payments').select('id').eq('claim_id',c.id)).data,[]);
});
