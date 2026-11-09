import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { admin, signIn, syntheticEmails } from './helpers.mjs';
import { createFinancialClaim, ok } from './phase04-fixture.mjs';
import { loadWorkflow } from './business-fixture.mjs';
const transition=(client,c,target,reason='',key=randomUUID())=>client.rpc('transition_claim',{
  p_claim_id:c.id,p_expected_updated_at:c.updated_at,p_target:target,p_request_key:key,p_reason:reason});
const current=async(client,id)=>ok(await client.from('claims').select('*').eq('id',id).single());

test('rejection requires a reason, preserves evidence and retains the task estimate',async()=>{
  const {claim,member,task}=await createFinancialClaim('Rejection scenario');
  const {client:treasurer}=await signIn(syntheticEmails.treasurer);
  const reviewed=await Promise.all([transition(treasurer,claim,'Under Review'),transition(treasurer,claim,'Under Review')]);
  assert.equal(reviewed.filter(r=>!r.error).length,1);
  let c=await current(member,claim.id);
  assert.equal((await transition(treasurer,c,'Rejected')).error?.code,'22023');
  const key=randomUUID(); ok(await transition(treasurer,c,'Rejected','Synthetic unsupported purchase',key));
  ok(await transition(treasurer,c,'Rejected','Synthetic unsupported purchase',key));
  c=await current(member,c.id); assert.equal(c.status,'Rejected'); assert.equal(c.decision_reason,'Synthetic unsupported purchase');
  assert.ok((await transition(treasurer,c,'Payment Pending')).error);
  assert.ok((await treasurer.rpc('payment_instructions',{p_claim_id:c.id})).error);
  assert.equal(ok(await member.from('claim_receipts').select('id').eq('claim_id',c.id)).length,1);
  assert.equal(ok(await member.from('claim_status_history').select('id').eq('claim_id',c.id).eq('to_status','Rejected')).length,1);
  assert.equal(ok(await member.from('reimbursement_payments').select('id').eq('claim_id',c.id)).length,0);
  assert.equal(ok(await member.from('purchase_tasks').select('estimated_budget_sen').eq('id',task.id).single()).estimated_budget_sen,8000);
  const f=ok(await treasurer.rpc('financial_summaries')).find(r=>r.departmentId===c.department_id);
  assert.ok(f.unclaimed>=8000);
});

test('hard budget overflow and corrupted submitted amounts cannot be approved',async()=>{
  const {claim,member}=await createFinancialClaim('Hard budget overflow',300000);
  const {client:treasurer}=await signIn(syntheticEmails.treasurer);
  ok(await transition(treasurer,claim,'Under Review'));
  let c=await current(member,claim.id);
  const risk=ok(await treasurer.rpc('assess_claim_risk',{p_claim_id:c.id}));
  assert.equal(risk.band,'High'); assert.ok(risk.departmentAvailable<0);
  assert.equal((await transition(treasurer,c,'Approved')).error?.code,'23514');
  assert.equal((await current(member,c.id)).status,'Under Review');
  ok(await admin.from('claims').update({claimed_amount_sen:299999}).eq('id',c.id));
  assert.equal((await transition(treasurer,c,'Approved')).error?.code,'23514');
  ok(await admin.from('claims').update({claimed_amount_sen:300000}).eq('id',c.id));
  ok(await transition(treasurer,c,'Rejected','Director budget increase is required before a different purchase can be approved.'));
});

test('conflicting decisions serialize to exactly one decision and one liability at most',async()=>{
  const {claim,member}=await createFinancialClaim('Conflicting decision scenario');
  const {client:treasurer}=await signIn(syntheticEmails.treasurer);
  ok(await transition(treasurer,claim,'Under Review'));
  const c=await current(member,claim.id);
  const results=await Promise.all([transition(treasurer,c,'Approved'),transition(treasurer,c,'Rejected','Synthetic alternative decision')]);
  assert.equal(results.filter(r=>!r.error).length,1);
  const final=await current(member,c.id); assert.ok(['Approved','Rejected'].includes(final.status));
  assert.equal(ok(await member.from('claim_status_history').select('to_status').eq('claim_id',c.id)
    .in('to_status',['Approved','Rejected'])).length,1);
  assert.ok((await member.from('receipt_modifications').delete().eq('claim_id',c.id)).error);
});

test('lower actual claims release planned exposure for new purchases without losing the estimate',async()=>{
  const {client:hod}=await signIn(syntheticEmails.multimediaHod);
  const w=await loadWorkflow();
  const before=ok(await hod.rpc('financial_summaries')).find(r=>r.departmentId===w.multimediaId);
  const estimate=before.available-1000;
  assert.ok(estimate>1000);
  const {claim,task}=await createFinancialClaim('Lower actual cost',1000,estimate);
  const raw=ok(await hod.from('purchase_tasks').select('estimated_budget_sen').eq('department_id',w.multimediaId).neq('status','Cancelled'))
    .reduce((sum,t)=>sum+t.estimated_budget_sen,0);
  const nextAmount=Math.max(1000,before.budget-raw+1);
  const next=ok(await hod.rpc('save_purchase_task',{
    p_id:null,p_request_key:randomUUID(),p_activity_id:claim.activity_id,p_department_id:claim.department_id,
    p_item_name:'Reuse available budget',p_description:'Synthetic canonical budget regression',
    p_assigned_member_id:claim.claimant_user_id,p_estimated_budget_sen:nextAmount,
    p_due_date:'2026-12-20',p_priority:'Medium',p_expected_updated_at:null}));
  assert.equal(next.estimated_budget_sen,nextAmount); assert.ok(raw+nextAmount>before.budget);
  assert.equal(ok(await admin.from('purchase_tasks').select('estimated_budget_sen').eq('id',task.id).single()).estimated_budget_sen,estimate);
  const f=ok(await hod.rpc('financial_summaries')).find(r=>r.departmentId===claim.department_id);
  assert.ok(f.available>=0); assert.ok(f.pending>=1000);
});
