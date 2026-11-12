import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { signIn, syntheticEmails, userId } from './helpers.mjs';
import { loadWorkflow } from './business-fixture.mjs';
export const ok = (r) => { assert.ifError(r.error); return r.data; };
export async function createFinancialClaim(name, amount=11000, estimate=8000, workflow) {
  const w=workflow??await loadWorkflow();
  const {client:hod}=await signIn(syntheticEmails.multimediaHod);
  const {client:member}=await signIn(syntheticEmails.multimediaMember);
  let task=ok(await hod.rpc('save_purchase_task',{
    p_id:null,p_request_key:randomUUID(),p_activity_id:w.activityId,p_department_id:w.multimediaId,
    p_item_name:name,p_description:'Synthetic Phase 04 verification purchase',p_assigned_member_id:await userId(syntheticEmails.multimediaMember),
    p_estimated_budget_sen:estimate,p_due_date:'2026-12-20',p_priority:'Medium',p_expected_updated_at:null}));
  task=ok(await member.rpc('update_my_purchase_progress',{p_task_id:task.id,p_status:'Purchased',p_expected_updated_at:task.updated_at}));
  const id=ok(await member.rpc('begin_my_claim',{p_task_id:task.id,p_request_key:randomUUID()}));
  const current=async()=>ok(await member.from('claims').select('*').eq('id',id).single());
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n9sAAAAASUVORK5CYII=','base64');
  const proof=ok(await member.rpc('prepare_claim_receipt',{p_claim_id:id,p_expected_updated_at:(await current()).updated_at,
    p_filename:'synthetic.png',p_mime:'image/png',p_size:bytes.length,p_sha256:createHash('sha256').update(bytes).digest('hex')}))[0];
  ok(await member.storage.from('receipts').upload(proof.storage_path,bytes,{contentType:'image/png'}));
  ok(await member.rpc('finalize_claim_receipt',{p_receipt_id:proof.receipt_id}));
  ok(await member.rpc('save_my_claim_baseline',{p_claim_id:id,p_expected_updated_at:(await current()).updated_at,
    p_receipt_id:proof.receipt_id,p_merchant:'Synthetic Supplies',p_purchase_date:'2026-11-05',p_total_sen:amount,
    p_method:'manual',p_raw_text:'Synthetic manually reviewed fixture',p_lines:[{id:'source-1',description:name,amount,kind:'item'}]}));
  const account=ok(await member.rpc('list_my_payment_accounts'))[0];
  ok(await member.rpc('save_my_claim_preferences',{p_claim_id:id,p_expected_updated_at:(await current()).updated_at,
    p_account_id:account.id,p_justification:'Synthetic cost exceeds the original estimate; independent review is required.'}));
  ok(await member.rpc('submit_my_claim',{p_claim_id:id,p_expected_updated_at:(await current()).updated_at,
    p_task_updated_at:task.updated_at,p_account_updated_at:account.updated_at,p_submission_key:randomUUID()}));
  return {claim:await current(),member,task,bytes};
}
