import type { ClaimDraft } from '../../domain/member';
import type { ReceiptEvidence, ReceiptLine } from '../../domain/treasury';
import type { Database, Json } from './database.types';
import { supabaseClient } from './client';

type ClaimRow = Database['public']['Tables']['claims']['Row'];
type ReceiptRow = Database['public']['Tables']['claim_receipts']['Row'];
type ItemRow = Database['public']['Tables']['claim_items']['Row'];
type EditRow = Database['public']['Tables']['receipt_modifications']['Row'];
const fail = (error: { message: string } | null, fallback: string) => {
  if (error) throw new Error(/^(Claim|Receipt|Draft|Upload|Line|Selected|Enter|Choose|Include|All|The|Account)/.test(error.message) ? error.message : fallback);
};
const object = (value: Json): Record<string, Json | undefined> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : {};
const line = (id: string, description: string, amount: number, kind?: string | null,
  quantityMilli?: number | null, unitPrice?: number | null): ReceiptLine => ({
  id, description, amount, kind: (kind ?? 'item') as ReceiptLine['kind'],
  ...(quantityMilli == null ? {} : { quantityMilli }), ...(unitPrice == null ? {} : { unitPrice }),
});
function sourceLine(row: ItemRow, original: boolean): ReceiptLine {
  return line(row.id, original ? row.original_description : row.corrected_description,
    Number(original ? row.original_line_total_sen : row.corrected_line_total_sen),
    original ? row.line_kind : row.line_kind,
    original ? row.original_quantity_milli : row.corrected_quantity_milli,
    original ? row.original_unit_price_sen : row.corrected_unit_price_sen);
}
function modifiedLine(id: string, value: Json): ReceiptLine {
  const v = object(value);
  return line(id, String(v.description ?? ''), Number(v.amount ?? 0), String(v.kind ?? 'item'),
    typeof v.quantityMilli === 'number' ? v.quantityMilli : null,
    typeof v.unitPrice === 'number' ? v.unitPrice : null);
}
export async function loadReceipt(claim: ClaimRow): Promise<ReceiptEvidence> {
  const client = supabaseClient();
  const { data: receipt, error } = await client.from('claim_receipts').select('*')
    .eq('claim_id', claim.id).eq('is_current', true).eq('upload_status', 'ready').maybeSingle();
  fail(error, 'Receipt evidence is unavailable in your authorized scope.');
  if (!receipt) throw new Error('No receipt was retained for this claim.');
  const [itemsResult, editsResult, signedResult] = await Promise.all([
    client.from('claim_items').select('*').eq('claim_id', claim.id).order('created_at'),
    client.from('receipt_modifications').select('*').eq('claim_id', claim.id).order('created_at'),
    client.storage.from('receipts').createSignedUrl(receipt.storage_path, 600),
  ]);
  fail(itemsResult.error, 'Receipt line history is unavailable.');
  fail(editsResult.error, 'Receipt modification history is unavailable.');
  fail(signedResult.error, 'Receipt download is unavailable in your authorized scope.');
  if (!signedResult.data?.signedUrl) throw new Error('Receipt download could not be authorized.');
  const items = itemsResult.data ?? [], edits = editsResult.data ?? [];
  const receiptEdits = edits.filter((e) => e.claim_item_id && e.field_changed === 'receipt_line').map((e) => {
    const before = object(e.before_value), after = object(e.after_value), id = e.claim_item_id!;
    return { lineId: id, before: modifiedLine(id, e.before_value), after: modifiedLine(id, e.after_value),
      excluded: before.included === true && after.included === false,
      beforeExcluded: before.included === false, reason: e.reason, actor: e.modified_by, at: e.created_at };
  });
  const totalEdits = edits.filter((e) => e.field_changed === 'reviewed_total_sen').map((e) => ({
    before: Number(e.before_value), after: Number(e.after_value), reason: e.reason,
    actor: e.modified_by, at: e.created_at,
  }));
  const originalLines = items.filter((i) => i.original_ocr_reference !== null).map((i) => sourceLine(i, true));
  const addedLines = items.filter((i) => i.original_ocr_reference === null).map((i) => sourceLine(i, true));
  const extraction = object(receipt.extraction ?? {});
  return {
    id: receipt.id, expenseId: claim.status === 'Pending' ? claim.id : '',
    originalUrl: signedResult.data.signedUrl, merchant: receipt.merchant ?? '',
    purchaseDate: receipt.purchase_date ?? undefined, originalTotal: Number(receipt.original_total_sen ?? 0),
    originalLines, addedLines, edits: receiptEdits, totalEdits,
    submittedAt: claim.submitted_at ?? claim.created_at,
    file: { name: receipt.original_filename, mime: receipt.mime_type as 'image/png' | 'image/jpeg', size: Number(receipt.size_bytes ?? 0) },
    extraction: { method: (extraction.method === 'manual' ? 'manual' : 'tesseract'),
      rawText: String(extraction.rawText ?? ''), at: String(extraction.at ?? receipt.uploaded_at ?? receipt.created_at) },
  };
}
export async function loadDraft(id: string): Promise<ClaimDraft> {
  const { data, error } = await supabaseClient().from('claims').select('*').eq('id', id).maybeSingle();
  fail(error, 'Claim draft could not be loaded.');
  if (!data || data.status !== 'Draft') throw new Error('Claim draft unavailable for your profile.');
  let receipt: ReceiptEvidence | undefined;
  const result = await supabaseClient().from('claim_receipts').select('id')
    .eq('claim_id', id).eq('is_current', true).eq('upload_status', 'ready').maybeSingle();
  fail(result.error, 'Receipt draft could not be loaded.');
  if (result.data) receipt = await loadReceipt(data);
  return { id: data.id, ownerId: data.claimant_user_id, taskId: data.purchase_task_id,
    receipt, accountId: data.draft_payment_account_id ?? '',
    justification: data.over_budget_justification, updatedAt: data.updated_at };
}
async function bytes(file: { dataUrl: string; mime: string; size: number }) {
  const [header, encoded] = file.dataUrl.split(',');
  if (!header?.startsWith(`data:${file.mime};base64`) || !encoded) throw new Error('Receipt image data is invalid.');
  const raw = atob(encoded), data = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const png = [137,80,78,71,13,10,26,10].every((v,i) => data[i] === v), jpg = data[0] === 255 && data[1] === 216 && data[2] === 255;
  if ((file.mime === 'image/png' && !png) || (file.mime === 'image/jpeg' && !jpg) || data.byteLength !== file.size)
    throw new Error('Receipt image signature or size does not match its file type.');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return { data, sha256: [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2,'0')).join('') };
}
export async function uploadReceipt(id: string, expected: string, file: { name: string; mime: string; size: number; dataUrl: string } | null) {
  const client = supabaseClient();
  if (!file) {
    const { data: current, error } = await client.from('claim_receipts').select('id,storage_path')
      .eq('claim_id', id).eq('is_current', true).maybeSingle();
    fail(error, 'Current receipt could not be loaded.');
    if (current) {
      const { error: abandonError } = await client.rpc('abandon_my_claim_receipt', { p_receipt_id: current.id });
      fail(abandonError, 'Unsubmitted receipt could not be removed.');
      const removed = await client.storage.from('receipts').remove([current.storage_path]);
      fail(removed.error, 'Receipt was marked for cleanup, but its stored file could not be removed.');
    }
    return;
  }
  const verified = await bytes(file);
  const { data: prepared, error: prepareError } = await client.rpc('prepare_claim_receipt', {
    p_claim_id: id, p_expected_updated_at: expected, p_filename: file.name.slice(0,180),
    p_mime: file.mime, p_size: file.size, p_sha256: verified.sha256,
  });
  fail(prepareError, 'Receipt upload could not be prepared.');
  const upload = prepared?.[0];
  if (!upload) throw new Error('Receipt upload could not be prepared.');
  const { error: uploadError } = await client.storage.from('receipts').upload(upload.storage_path,
    new Blob([verified.data], { type: file.mime }), { contentType: file.mime, upsert: false });
  if (uploadError) {
    const finalized = await client.rpc('finalize_claim_receipt', { p_receipt_id: upload.receipt_id });
    if (finalized.error) throw new Error(uploadError.message.includes('already exists')
      ? 'Receipt retry could not be verified. Choose the image again.' : 'Receipt upload failed. Retry or choose the image again.');
  } else {
    const finalized = await client.rpc('finalize_claim_receipt', { p_receipt_id: upload.receipt_id });
    fail(finalized.error, 'Uploaded receipt could not be finalized. Retry the upload.');
  }
  const { data: old, error: oldError } = await client.from('claim_receipts').select('storage_path')
    .eq('claim_id', id).eq('upload_status', 'abandoned');
  fail(oldError, 'Previous draft receipt cleanup could not be checked.');
  if (old?.length) fail((await client.storage.from('receipts').remove(old.map((r) => r.storage_path))).error,
    'Receipt was saved, but an older draft file needs cleanup. Retry receipt replacement later.');
}
