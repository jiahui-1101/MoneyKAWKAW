import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { admin, anonymous, signIn, syntheticEmails } from './helpers.mjs';
import { ok } from './phase04-fixture.mjs';
import { archiveFixture, archiveClaim, archiveEdge, transition, recordSyntheticPayment } from './phase08-fixture.mjs';

test('closing reconciles one payment, freezes writes and archives retained evidence', async () => {
  const f = await archiveFixture('Phase 08 received and archived');
  const { claim, task, bytes } = await archiveClaim(f);
  const id = f.activityId;
  const readiness = async () => ok(await f.treasurer.rpc('activity_closing_readiness', { p_activity: id, p_role: 'Treasurer' }));
  const report = async () => ok(await f.director.rpc('activity_closing_report', { p_activity: id, p_role: 'Director' }));
  const sign = (revision, requestKey = randomUUID()) => f.treasurer.rpc('sign_activity_reconciliation', {
    p_activity: id, p_revision: revision, p_request_key: requestKey,
  });
  const close = { p_activity: id };
  assert.equal((await f.member.rpc('request_activity_close', close)).error?.code, '42501');
  assert.equal((await f.hod.rpc('reserve_activity_archive', close)).error?.code, '42501');
  assert.equal((await f.director.rpc('reserve_activity_archive', close)).error?.code, '23514');
  const first = ok(await f.director.rpc('request_activity_close', close));
  assert.equal(ok(await f.director.rpc('request_activity_close', close)), first);
  let facts = await readiness();
  assert.equal(facts.blockers.pendingClaims, 1);
  assert.equal((await sign(facts.revision)).error?.code, '23514');
  await transition(f, claim.id, 'Under Review');
  await transition(f, claim.id, 'Approved');
  facts = await readiness();
  assert.equal(facts.blockers.approvedUnpaid, 1);
  assert.equal(facts.liability, 11000);
  assert.equal((await sign(facts.revision)).error?.code, '23514');

  const { payment, proof, args } = await recordSyntheticPayment(f, claim.id, bytes);
  ok(await f.member.rpc('report_payment_issue', {
    p_payment_id: payment, p_request_key: randomUUID(), p_reason: 'Synthetic discrepancy', p_received_sen: 0,
  }));
  const paid = await readiness();
  assert.equal(paid.blockers.unconfirmedPaid, 1);
  assert.equal(paid.blockers.openDiscrepancies, 1);
  assert.equal((await sign(paid.revision)).error?.code, '23514');
  ok(await f.treasurer.rpc('resolve_payment_issue', {
    p_payment_id: payment, p_request_key: randomUUID(), p_note: 'Synthetic issue reviewed.',
  }));
  await transition(f, claim.id, 'Received');
  const reconciled = await readiness();
  assert.equal(reconciled.payments, 1);
  assert.equal(reconciled.confirmed, 1);
  assert.equal(reconciled.paid, 11000);
  assert.equal(reconciled.paymentTotal, 11000);
  assert.equal(reconciled.unspentAllocated, 189000);
  assert.equal(reconciled.unallocated, 800000);
  assert.equal(reconciled.departments[0].remaining, 189000);
  assert.ok(Object.values(reconciled.blockers).every((count) => count === 0));
  assert.equal((await sign(paid.revision)).error?.code, '40001');

  const key = randomUUID();
  const [primary, conflicting] = await Promise.all([sign(reconciled.revision, key), sign(reconciled.revision)]);
  assert.equal([primary, conflicting].filter((result) => !result.error).length, 1);
  const signed = primary.data ?? conflicting.data;
  if (primary.data) assert.equal(ok(await sign(reconciled.revision, key)), signed);
  assert.ok((await admin.from('activity_reconciliations').update({ facts: {} }).eq('id', signed)).error);
  let decision = {
    p_activity: id, p_reconciliation: signed, p_revision: (await report()).revision,
    p_request_key: randomUUID(), p_approved: true, p_reason: '',
  };
  ok(await admin.from('club_role_grants').insert({ club_id: claim.club_id, user_id: f.treasurerUser.id, role: 'Director' }));
  try {
    assert.equal((await f.treasurer.rpc('decide_activity_reconciliation', decision)).error?.code, '42501');
  } finally {
    ok(await admin.from('club_role_grants').delete().eq('user_id', f.treasurerUser.id).eq('role', 'Director'));
  }
  assert.equal((await f.hod.rpc('decide_activity_reconciliation', decision)).error?.code, '42501');
  ok(await f.director.rpc('decide_activity_reconciliation', { ...decision, p_approved: false, p_reason: 'Confirm the retained originals again.' }));
  assert.equal((await report()).state, 'Closing');
  const newer = ok(await sign((await readiness()).revision));
  assert.notEqual(newer, signed);
  decision = { ...decision, p_reconciliation: newer, p_revision: (await report()).revision, p_request_key: randomUUID() };
  const approved = ok(await f.director.rpc('decide_activity_reconciliation', decision));
  assert.equal(ok(await f.director.rpc('decide_activity_reconciliation', decision)), approved);
  assert.equal((await report()).history.length, 2);

  const response = await archiveEdge(f.director, id, 'Director', 'generate');
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.evidenceCount, 2);
  assert.equal(result.evidenceBytes, bytes.length * 2);
  const archived = await report();
  assert.equal(archived.state, 'Archived');
  assert.equal(archived.archive.verification_state, 'Verified');
  assert.equal(archived.facts.paid, 11000);
  assert.equal((await archiveEdge(f.director, id, 'Director', 'download')).status, 403);
  assert.equal((await archiveEdge(f.member, id, 'Treasurer', 'download')).status, 403);
  assert.equal((await archiveEdge(f.hod, id, 'Treasurer', 'verify')).status, 403);
  const download = await archiveEdge(f.treasurer, id, 'Treasurer', 'download');
  assert.equal(download.status, 200);
  const compressed = Buffer.from(await download.arrayBuffer());
  const source = gunzipSync(compressed);
  assert.equal(createHash('sha256').update(compressed).digest('hex'), result.compressedSha256);
  assert.equal(createHash('sha256').update(source).digest('hex'), result.logicalSha256);
  const archive = JSON.parse(source);
  assert.equal(archive.version, 1);
  assert.equal(archive.records.payments.length, 1);
  assert.equal(archive.records.claims[0].status, 'Received');
  assert.equal(archive.records.evidence.length, 2);
  assert.doesNotMatch(source.toString(), /"identifier"|0000000011113210|9876543210/);
  const material = ok(await admin.rpc('activity_archive_material', { p_archive: result.id }));
  assert.equal(material.source_text, null);
  for (const client of [f.director, f.treasurer, f.member, anonymous])
    assert.ok((await client.storage.from('financial-archive').createSignedUrl(material.object_path, 60)).error);
  assert.ok((await f.director.from('archive_records').select('*')).error);
  assert.ok((await f.director.rpc('activity_archive_material', { p_archive: result.id })).error);
  assert.ok((await f.hod.rpc('update_hod_purchase_task_status', {
    p_task_id: task.id, p_status: 'Completed', p_expected_updated_at: task.updated_at,
  })).error);
  assert.ok((await f.member.rpc('begin_my_claim', { p_task_id: task.id, p_request_key: randomUUID() })).error);
  assert.ok((await f.treasurer.rpc('record_reimbursement', { ...args, p_request_key: randomUUID() })).error);
  const other = (await signIn(syntheticEmails.marketingMember)).client;
  assert.ok((await other.storage.from('payment-proofs').createSignedUrl(proof.storage_path, 60)).error);
  ok(await admin.from('department_memberships').update({ status: 'revoked' }).eq('department_id', f.multimediaId).eq('user_id', f.memberId));
  assert.ok((await f.member.storage.from('payment-proofs').createSignedUrl(proof.storage_path, 60)).error);
  assert.equal(ok(await f.member.from('claims').select('id').eq('id', claim.id)).length, 0);
});
