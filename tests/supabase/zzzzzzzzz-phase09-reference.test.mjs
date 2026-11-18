import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { archiveFixture, transition, currentClaim, recordSyntheticPayment, approveClosing, archiveEdge } from './phase08-fixture.mjs';
import { ok } from './phase04-fixture.mjs';

test('RM125 original minus RM15 personal line produces one RM110 expense through archive', async () => {
  const f = await archiveFixture('Phase09 exact reference ledger');
  const facts = async () => ok(await f.director.rpc('activity_closing_report', {
    p_activity: f.activityId, p_role: 'Director',
  })).facts;
  async function balances(reserved, pending, liability, paid) {
    const data = await facts();
    assert.deepEqual([data.reserved,data.pending,data.liability,data.paid], [reserved,pending,liability,paid]);
    assert.equal(data.budget, 1000000);
    assert.equal(data.allocated, 200000);
    assert.equal(data.available, 1000000 - reserved - pending - liability - paid);
    assert.equal(data.departments[0].available, 200000 - reserved - pending - liability - paid);
  }
  await balances(0, 0, 0, 0);
  const task = ok(await f.hod.rpc('save_purchase_task', {
    p_id: null,p_request_key:randomUUID(),p_activity_id:f.activityId,p_department_id:f.multimediaId,
    p_item_name:'HDMI reference',p_description:'Synthetic reference purchase',p_assigned_member_id:f.memberId,
    p_estimated_budget_sen:8000,p_due_date:'2026-12-20',p_priority:'Medium',p_expected_updated_at:null,
  }));
  const purchased = ok(await f.member.rpc('update_my_purchase_progress', {
    p_task_id:task.id,p_status:'Purchased',p_expected_updated_at:task.updated_at,
  }));
  await balances(8000, 0, 0, 0);
  const claim = ok(await f.member.rpc('begin_my_claim',{p_task_id:task.id,p_request_key:randomUUID()}));
  const current = () => currentClaim(f, claim);
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n9sAAAAASUVORK5CYII=','base64');
  const receipt = ok(await f.member.rpc('prepare_claim_receipt', {
    p_claim_id:claim,p_expected_updated_at:(await current()).updated_at,p_filename:'synthetic.png',
    p_mime:'image/png',p_size:bytes.length,p_sha256:createHash('sha256').update(bytes).digest('hex'),
  }))[0];
  ok(await f.member.storage.from('receipts').upload(receipt.storage_path,bytes,{contentType:'image/png'}));
  ok(await f.member.rpc('finalize_claim_receipt',{p_receipt_id:receipt.receipt_id}));
  ok(await f.member.rpc('save_my_claim_baseline', {
    p_claim_id:claim,p_expected_updated_at:(await current()).updated_at,p_receipt_id:receipt.receipt_id,
    p_merchant:'Synthetic Supplies',p_purchase_date:'2026-11-05',p_total_sen:12500,p_method:'manual',
    p_raw_text:'Synthetic reference ledger fixture',p_lines:[
      {id:'hdmi',description:'HDMI Cable',amount:11000,kind:'item'},
      {id:'personal',description:'Personal snacks',amount:1500,kind:'item'},
    ],
  }));
  const personal = ok(await f.member.from('claim_items').select('id').eq('claim_id',claim).eq('original_description','Personal snacks').single());
  ok(await f.member.rpc('edit_my_claim_item', {
    p_claim_id:claim,p_expected_updated_at:(await current()).updated_at,p_item_id:personal.id,
    p_line:{description:'Personal snacks',amount:1500,kind:'item'},p_excluded:true,
    p_reason:'Personal item excluded',p_modification_type:'Item Exclusion',
  }));
  await balances(8000, 0, 0, 0);
  const account = ok(await f.member.rpc('list_my_payment_accounts'))[0];
  ok(await f.member.rpc('save_my_claim_preferences', {
    p_claim_id:claim,p_expected_updated_at:(await current()).updated_at,p_account_id:account.id,
    p_justification:'Required HDMI cost RM30 above estimate. Personal RM15 excluded.',
  }));
  ok(await f.member.rpc('submit_my_claim', {
    p_claim_id:claim,p_expected_updated_at:(await current()).updated_at,
    p_task_updated_at:purchased.updated_at,p_account_updated_at:account.updated_at,p_submission_key:randomUUID(),
  }));
  await balances(0, 11000, 0, 0);
  await transition(f, claim, 'Under Review');
  await balances(0, 11000, 0, 0);
  const risk = ok(await f.treasurer.rpc('assess_claim_risk',{p_claim_id:claim}));
  assert.equal(risk.variancePercent, 37.5);
  await transition(f, claim, 'Approved');
  await balances(0, 0, 11000, 0);
  await recordSyntheticPayment(f, claim, bytes);
  await balances(0, 0, 0, 11000);
  await transition(f, claim, 'Received');
  await balances(0, 0, 0, 11000);
  await approveClosing(f);
  const response = await archiveEdge(f.director, f.activityId, 'Director', 'generate');
  assert.equal(response.status, 200, await response.text());
  await balances(0, 0, 0, 11000);
  const archived = await facts();
  assert.equal(archived.unspentAllocated,189000);
  assert.equal(archived.unallocated,800000);
  assert.equal(archived.payments,1);
});
