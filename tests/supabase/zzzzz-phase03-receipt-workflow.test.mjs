import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { signIn, syntheticEmails, userId } from './helpers.mjs';
import { loadWorkflow } from './business-fixture.mjs';

test('private receipt, audited edits, account snapshot, and pending claim persist atomically', async () => {
  const workflow = await loadWorkflow();
  const [hod, member, treasurer, otherMember] = await Promise.all([
    signIn(syntheticEmails.multimediaHod), signIn(syntheticEmails.multimediaMember),
    signIn(syntheticEmails.treasurer), signIn(syntheticEmails.marketingMember),
  ]);
  const task = await hod.client.rpc('save_purchase_task', {
    p_id: null, p_request_key: randomUUID(), p_activity_id: workflow.activityId,
    p_department_id: workflow.multimediaId, p_item_name: 'Synthetic HDMI adapter',
    p_description: 'Claim workflow verification', p_assigned_member_id: await userId(syntheticEmails.multimediaMember),
    p_estimated_budget_sen: 4_000, p_due_date: '2026-12-20', p_priority: 'Low', p_expected_updated_at: null,
  });
  assert.ifError(task.error);
  let changed = await member.client.rpc('update_my_purchase_progress', {
    p_task_id: task.data.id, p_status: 'In Progress', p_expected_updated_at: task.data.updated_at,
  });
  assert.ifError(changed.error);
  changed = await member.client.rpc('update_my_purchase_progress', {
    p_task_id: task.data.id, p_status: 'Purchased', p_expected_updated_at: changed.data.updated_at,
  });
  assert.ifError(changed.error);
  const account = await member.client.rpc('save_my_payment_account', {
    p_account_id: null, p_expected_updated_at: null, p_label: 'Synthetic account', p_kind: 'Bank',
    p_holder: 'Synthetic Member', p_institution: 'Test Bank', p_identifier: '9876543210', p_is_default: true,
  });
  assert.ifError(account.error);
  const accountSummary = await member.client.rpc('list_my_payment_accounts');
  assert.ifError(accountSummary.error);
  const accountRow = accountSummary.data.find((row) => row.id === account.data);
  assert.ok(accountRow?.masked.includes('3210'));

  const started = await member.client.rpc('begin_my_claim', { p_task_id: task.data.id, p_request_key: randomUUID() });
  assert.ifError(started.error);
  const claimId = started.data;
  const draft = async () => member.client.from('claims').select('updated_at').eq('id', claimId).single();
  const draftRow = await draft();
  assert.ifError(draftRow.error);
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n9sAAAAASUVORK5CYII=', 'base64');
  const prepared = await member.client.rpc('prepare_claim_receipt', {
    p_claim_id: claimId, p_expected_updated_at: draftRow.data.updated_at, p_filename: 'synthetic.png',
    p_mime: 'image/png', p_size: bytes.length, p_sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  assert.ifError(prepared.error);
  const receipt = prepared.data[0];
  const upload = await member.client.storage.from('receipts').upload(receipt.storage_path, bytes,
    { contentType: 'image/png', upsert: false });
  assert.ifError(upload.error);
  const finalized = await member.client.rpc('finalize_claim_receipt', { p_receipt_id: receipt.receipt_id });
  assert.ifError(finalized.error);
  const postUpload = await draft();
  assert.ifError(postUpload.error);
  const captured = await member.client.rpc('save_my_claim_baseline', {
    p_claim_id: claimId, p_expected_updated_at: postUpload.data.updated_at, p_receipt_id: receipt.receipt_id,
    p_merchant: 'DEMO SUPPLIES', p_purchase_date: '2026-11-05', p_total_sen: 6_200,
    p_method: 'manual', p_raw_text: 'Synthetic sample; manual review', p_lines: [
      { id: 'line-1', description: 'HDMI adapter', amount: 4_500, kind: 'item' },
      { id: 'line-2', description: 'Personal snacks', amount: 1_500, kind: 'item' },
    ],
  });
  assert.ifError(captured.error);
  assert.equal((await member.client.from('claim_receipts').select('extraction').eq('id', receipt.receipt_id).single()).data.extraction.method, 'manual');
  const correctedTotal = await member.client.rpc('correct_my_claim_receipt_total', {
    p_claim_id: claimId, p_expected_updated_at: captured.data, p_total_sen: 6_000, p_reason: 'Corrected the manually reviewed receipt total.',
  });
  assert.ifError(correctedTotal.error);
  const items = await member.client.from('claim_items').select('id,corrected_description').eq('claim_id', claimId);
  assert.ifError(items.error);
  const snack = items.data.find((item) => item.corrected_description === 'Personal snacks');
  const excluded = await member.client.rpc('edit_my_claim_item', {
    p_claim_id: claimId, p_expected_updated_at: correctedTotal.data, p_item_id: snack.id,
    p_line: { description: 'Personal snacks', amount: 1_500, kind: 'item' }, p_excluded: true,
    p_reason: 'Personal purchase excluded from reimbursement', p_modification_type: 'Item Exclusion',
  });
  assert.ifError(excluded.error);
  assert.equal((await member.client.from('receipt_modifications').select('id').eq('claim_id', claimId)).data.length, 2);
  assert.equal((await member.client.from('claim_items').select('included').eq('id', snack.id).single()).data.included, false);

  let current = await draft();
  let prefs = await member.client.rpc('save_my_claim_preferences', {
    p_claim_id: claimId, p_expected_updated_at: current.data.updated_at, p_account_id: account.data, p_justification: '',
  });
  assert.ifError(prefs.error);
  const submitKey = randomUUID();
  const submitArgs = {
    p_claim_id: claimId, p_expected_updated_at: prefs.data, p_task_updated_at: changed.data.updated_at,
    p_account_updated_at: accountRow.updated_at, p_submission_key: submitKey,
  };
  assert.equal((await member.client.rpc('submit_my_claim', submitArgs)).error?.code, '23514');
  prefs = await member.client.rpc('save_my_claim_preferences', {
    p_claim_id: claimId, p_expected_updated_at: prefs.data, p_account_id: account.data,
    p_justification: 'Purchased adapter exceeded its task estimate by RM5.00.',
  });
  assert.ifError(prefs.error);
  submitArgs.p_expected_updated_at = prefs.data;
  const submitted = await member.client.rpc('submit_my_claim', submitArgs);
  assert.ifError(submitted.error);
  assert.equal((await member.client.rpc('submit_my_claim', submitArgs)).data, claimId);

  const saved = await treasurer.client.from('claims').select('status,claimed_amount_sen,over_budget_amount_sen,item_budget_sen_snapshot').eq('id', claimId).single();
  assert.ifError(saved.error);
  assert.deepEqual(saved.data, { status: 'Pending', claimed_amount_sen: 4_500, over_budget_amount_sen: 500, item_budget_sen_snapshot: 4_000 });
  assert.equal((await member.client.from('purchase_tasks').select('estimated_budget_sen').eq('id', task.data.id).single()).data.estimated_budget_sen, 4_000);
  assert.deepEqual((await otherMember.client.from('claims').select('id').eq('id', claimId)).data, []);
  const destination = await treasurer.client.rpc('my_claim_destination', { p_claim_id: claimId });
  assert.ifError(destination.error);
  assert.ok(destination.data[0].masked.includes('3210'));
  assert.equal('identifier' in destination.data[0], false);
  assert.ok((await otherMember.client.storage.from('receipts').createSignedUrl(receipt.storage_path, 60)).error);
  assert.ok((await treasurer.client.storage.from('receipts').createSignedUrl(receipt.storage_path, 60)).data?.signedUrl);
  assert.ok((await treasurer.client.from('claims').update({ status: 'Paid' }).eq('id', claimId)).error);
});
