import type { ProofFile } from '../../domain/treasury';
import type { PaymentInput } from '../reimbursements';
import { validateProof } from '../payment-proof';
import { supabaseClient } from './client';
import { checked, currentClaim, requestKey } from './finance';
export async function recordPayment(id: string, input: PaymentInput) {
  if (!input.confirmed) throw new Error('Explicit external-transfer confirmation is required.');
  validateProof(input.proof);
  if (!['image/png', 'image/jpeg'].includes(input.proof.mime)) throw new Error('Choose a PNG or JPEG payment proof.');
  const client = supabaseClient();
  const bytes = Uint8Array.from(atob(input.proof.dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const proof = checked(await client.rpc('prepare_payment_proof', { p_claim_id: id, p_filename: input.proof.name,
    p_mime: input.proof.mime, p_size: bytes.length, p_sha256: hash }));
  if (proof.upload_status === 'uploading') {
    const upload = await client.storage.from('payment-proofs').upload(proof.storage_path,
      new Blob([bytes], { type: input.proof.mime }), { contentType: input.proof.mime, upsert: false });
    if (upload.error) {
      const finalized = await client.rpc('finalize_payment_proof', { p_proof_id: proof.id });
      if (finalized.error) throw new Error('Payment proof upload failed. Retry with the same image.');
    } else checked(await client.rpc('finalize_payment_proof', { p_proof_id: proof.id }));
  }
  const abandoned = checked(await client.from('payment_proofs').select('storage_path').eq('claim_id', id).eq('upload_status', 'abandoned'));
  if (abandoned.length) checked(await client.storage.from('payment-proofs').remove(abandoned.map((p) => p.storage_path)));
  const claim = await currentClaim(id);
  return checked(await client.rpc('record_reimbursement', { p_claim_id: id, p_expected_updated_at: claim.updated_at,
    p_request_key: requestKey(`${id}:payment:${input.reference}:${input.date}:${hash}:${input.amount}`),
    p_amount_sen: input.amount, p_payment_date: input.date, p_reference: input.reference,
    p_proof_id: proof.id, p_destination_revision: input.destinationRevision, p_confirmed: input.confirmed }));
}
export function safeProofMetadata(name: string, mime: string, size: number): ProofFile {
  return { name, mime: mime as ProofFile['mime'], size, dataUrl: '' };
}
