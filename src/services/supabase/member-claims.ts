import type { ReceiptLine } from '../../domain/treasury';
import type { Database, Json } from './database.types';
import { supabaseClient } from './client';
const nullable = <T>(value: T | null) => value as unknown as T;
function check<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) {
    const expected = /^(Sign in|Purchasing task|An active claim|Claim|Draft|Receipt|Upload|Choose|Enter|Line|Selected|All|Include|The|This|Payment account|Mark|Original)/;
    throw new Error(expected.test(error.message) ? error.message : fallback);
  }
  if (data === null) throw new Error(fallback);
  return data;
}
export async function beginClaim(taskId: string) {
  const { data, error } = await supabaseClient().rpc('begin_my_claim', {
    p_task_id: taskId, p_request_key: crypto.randomUUID(),
  });
  return check(data, error, 'Claim preparation could not be started.');
}
export async function saveBaseline(input: { id: string; expected: string; receiptId: string;
  merchant: string; purchaseDate: string; originalTotal: number; lines: ReceiptLine[];
  method: 'tesseract' | 'manual'; rawText: string }) {
  const { data, error } = await supabaseClient().rpc('save_my_claim_baseline', {
    p_claim_id: input.id, p_expected_updated_at: input.expected, p_receipt_id: input.receiptId,
    p_merchant: input.merchant, p_purchase_date: input.purchaseDate, p_total_sen: input.originalTotal,
    p_method: input.method, p_raw_text: input.rawText, p_lines: input.lines as unknown as Json,
  });
  return check(data, error, 'Receipt source values could not be saved.');
}
export async function editLine(input: { claimId: string; expected: string; itemId?: string;
  line: ReceiptLine; excluded: boolean; reason: string;
  type: Database['public']['Enums']['receipt_modification_type'] }) {
  const { data, error } = await supabaseClient().rpc('edit_my_claim_item', {
    p_claim_id: input.claimId, p_expected_updated_at: input.expected,
    p_item_id: nullable(input.itemId ?? null), p_line: input.line as unknown as Json,
    p_excluded: input.excluded, p_reason: input.reason, p_modification_type: input.type,
  });
  return check(data, error, 'Receipt modification could not be saved.');
}
export async function editReceiptTotal(id: string, expected: string, amount: number, reason: string) {
  const { data, error } = await supabaseClient().rpc('correct_my_claim_receipt_total', {
    p_claim_id: id, p_expected_updated_at: expected, p_total_sen: amount, p_reason: reason,
  });
  return check(data, error, 'Reviewed receipt total could not be saved.');
}
export async function savePreferences(id: string, expected: string, accountId: string, reason: string) {
  const { data, error } = await supabaseClient().rpc('save_my_claim_preferences', {
    p_claim_id: id, p_expected_updated_at: expected, p_account_id: nullable(accountId || null),
    p_justification: reason,
  });
  return check(data, error, 'Draft payment selection could not be saved.');
}
export async function submitClaim(id: string, expected: string, taskUpdatedAt: string,
  accountUpdatedAt: string, submissionKey: string) {
  const { data, error } = await supabaseClient().rpc('submit_my_claim', {
    p_claim_id: id, p_expected_updated_at: expected, p_task_updated_at: taskUpdatedAt,
    p_account_updated_at: accountUpdatedAt, p_submission_key: submissionKey,
  });
  return check(data, error, 'Claim could not be submitted. No success was recorded.');
}
export async function claimDestination(id: string) {
  const { data, error } = await supabaseClient().rpc('my_claim_destination', { p_claim_id: id });
  return check(data, error, 'Selected payment destination is unavailable.')[0];
}
