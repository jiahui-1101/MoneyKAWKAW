import type { PayoutSnapshot, ProofFile, RiskResult } from '../../domain/treasury';
import { supabaseClient } from './client';
import type { Database } from './database.types';
const keys = new Map<string, string>();
export function requestKey(scope: string) {
  if (!keys.has(scope)) keys.set(scope, crypto.randomUUID());
  if (keys.size > 200) keys.delete(keys.keys().next().value!);
  return keys.get(scope)!;
}
export function checked<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data!;
}
export async function currentClaim(id: string) {
  const data = checked(await supabaseClient().from('claims').select('*').eq('id', id).maybeSingle());
  if (!data) throw new Error('Claim unavailable in your current authorized scope.');
  return data;
}
export async function transitionClaim(id: string, target: Database['public']['Enums']['claim_status'], expected: string, reason = '') {
  return checked(await supabaseClient().rpc('transition_claim', { p_claim_id: id, p_target: target,
    p_expected_updated_at: expected, p_request_key: requestKey(`${id}:${target}:${expected}:${reason}`), p_reason: reason }));
}
export async function assessRisk(id: string): Promise<RiskResult> {
  return checked(await supabaseClient().rpc('assess_claim_risk', { p_claim_id: id })) as unknown as RiskResult;
}
export async function paymentInstructions(id: string): Promise<PayoutSnapshot & { revision: string }> {
  const c = await currentClaim(id);
  if (c.status === 'Approved') await transitionClaim(id, 'Payment Pending', c.updated_at);
  const data = checked(await supabaseClient().rpc('payment_instructions', { p_claim_id: id }));
  const d = data?.[0];
  if (!d) throw new Error('Frozen payment instructions unavailable.');
  return { expenseId: id, ownerId: c.claimant_user_id, label: d.label, kind: d.kind as PayoutSnapshot['kind'],
    holder: d.holder, institution: d.institution, identifier: d.identifier, masked: d.masked, revision: d.revision };
}
export async function paymentProof(paymentId: string): Promise<ProofFile> {
  const client = supabaseClient();
  const payment = checked(await client.from('reimbursement_payments').select('proof_id').eq('id', paymentId).maybeSingle());
  if (!payment) throw new Error('Payment unavailable in your authorized scope.');
  const proof = checked(await client.from('payment_proofs').select('*').eq('id', payment.proof_id).maybeSingle());
  if (!proof) throw new Error('Payment proof unavailable.');
  const signed = checked(await client.storage.from('payment-proofs').createSignedUrl(proof.storage_path, 300));
  return { name: proof.filename, mime: proof.mime_type as ProofFile['mime'], size: proof.size_bytes, dataUrl: signed.signedUrl };
}
export async function reportPaymentIssue(id: string, reason: string, received?: number) {
  checked(await supabaseClient().rpc('report_payment_issue', { p_payment_id: id,
    p_request_key: requestKey(`${id}:issue:${reason}:${received}`), p_reason: reason,
    p_received_sen: (received ?? null) as unknown as number }));
}
export async function resolvePaymentIssue(id: string, note: string) {
  checked(await supabaseClient().rpc('resolve_payment_issue', { p_payment_id: id,
    p_request_key: requestKey(`${id}:resolve:${note}`), p_note: note }));
}
