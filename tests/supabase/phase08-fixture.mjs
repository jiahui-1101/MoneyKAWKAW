import { createHash, randomUUID } from 'node:crypto';
import { local, signIn, syntheticEmails, userId } from './helpers.mjs';
import { createFinancialClaim, ok } from './phase04-fixture.mjs';

export async function archiveFixture(name) {
  const { client: director } = await signIn(syntheticEmails.director);
  const { client: treasurer, user: treasurerUser } = await signIn(syntheticEmails.treasurer);
  const { client: member } = await signIn(syntheticEmails.multimediaMember);
  const { client: hod } = await signIn(syntheticEmails.multimediaHod);
  const activityId = ok(await director.rpc('save_activity', {
    p_id: null, p_name: name, p_description: 'Synthetic archive verification fixture',
    p_type: 'Small Event', p_status: 'Active', p_start_date: '2026-11-01',
    p_end_date: '2026-12-31', p_budget_sen: 1000000,
  }));
  const memberId = await userId(syntheticEmails.multimediaMember);
  const multimediaId = ok(await director.rpc('save_department_setup', {
    p_activity_id: activityId, p_department_id: null, p_name: 'Multimedia',
    p_description: 'Synthetic assigned scope', p_head_label: '', p_allocation_sen: 200000,
    p_hod_user_id: await userId(syntheticEmails.multimediaHod), p_member_user_ids: [memberId],
  }));
  if (!ok(await member.rpc('list_my_payment_accounts')).length) {
    ok(await member.rpc('save_my_payment_account', {
      p_account_id: null, p_expected_updated_at: null, p_label: 'Synthetic archive account',
      p_kind: 'Bank', p_holder: 'Synthetic Member', p_institution: 'Test Bank',
      p_identifier: '0000000011113210', p_is_default: true,
    }));
  }
  return { activityId, multimediaId, director, treasurer, treasurerUser, member, memberId, hod };
}

export const archiveClaim = (fixture, name = 'HDMI Cable') => createFinancialClaim(name, 11000, 8000, fixture);
export const currentClaim = async (fixture, claim) =>
  ok(await fixture.member.from('claims').select('*').eq('id', claim).single());
export async function transition(fixture, claim, target, reason = '') {
  const current = await currentClaim(fixture, claim);
  const client = target === 'Received' ? fixture.member : fixture.treasurer;
  return ok(await client.rpc('transition_claim', {
    p_claim_id: claim, p_target: target, p_expected_updated_at: current.updated_at,
    p_request_key: randomUUID(), p_reason: reason,
  }));
}

export async function recordSyntheticPayment(fixture, claim, bytes) {
  const client = fixture.treasurer;
  const pending = await transition(fixture, claim, 'Payment Pending');
  const instructions = ok(await client.rpc('payment_instructions', { p_claim_id: claim }))[0];
  const proof = ok(await client.rpc('prepare_payment_proof', {
    p_claim_id: claim, p_filename: 'synthetic-proof.png', p_mime: 'image/png',
    p_size: bytes.length, p_sha256: createHash('sha256').update(bytes).digest('hex'),
  }));
  ok(await client.storage.from('payment-proofs').upload(proof.storage_path, bytes, { contentType: 'image/png' }));
  ok(await client.rpc('finalize_payment_proof', { p_proof_id: proof.id }));
  const args = {
    p_claim_id: claim, p_expected_updated_at: pending, p_request_key: randomUUID(),
    p_amount_sen: 11000, p_payment_date: new Date().toISOString().slice(0, 10),
    p_reference: 'SYNTHETIC-ARCHIVE-' + claim.slice(0, 8), p_proof_id: proof.id,
    p_destination_revision: instructions.revision, p_confirmed: true,
  };
  return { payment: ok(await client.rpc('record_reimbursement', args)), proof, args };
}

export async function archiveEdge(client, activity, role, operation) {
  const session = ok(await client.auth.getSession()).session;
  return fetch(local.url + '/functions/v1/activity-archive', {
    method: 'POST',
    headers: { apikey: local.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity, role, operation }),
  });
}
