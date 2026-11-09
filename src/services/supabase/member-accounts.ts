import type { AccountInput, AccountSummary, PaymentAccount } from '../../domain/member';
import { getDemoActor } from '../../domain/session';
import { supabaseClient } from './client';

function result<T>(data: T | null, error: { message: string } | null, fallback: string): T {
  if (error) {
    const expected = /^(Payment account|Enter valid|Account identifier|This account|Select one of|The account)/;
    throw new Error(expected.test(error.message) ? error.message : fallback);
  }
  if (data === null) throw new Error(fallback);
  return data;
}
const nullable = (value: string | null) => value as unknown as string;
export async function listAccounts(): Promise<AccountSummary[]> {
  const { data, error } = await supabaseClient().rpc('list_my_payment_accounts');
  return result(data, error, 'Payment accounts could not be loaded.').map((a) => ({
    id: a.id, ownerId: getDemoActor().userId, label: a.label, kind: a.kind as AccountSummary['kind'],
    holder: a.holder, institution: a.institution, masked: a.masked, isDefault: a.is_default,
    updatedAt: a.updated_at, inUse: a.in_use,
  }));
}
export async function getAccount(id: string): Promise<PaymentAccount> {
  const { data, error } = await supabaseClient().rpc('get_my_payment_account', { p_account_id: id });
  const row = result(data, error, 'Payment account unavailable for your profile.')[0];
  if (!row) throw new Error('Payment account unavailable for your profile.');
  return { id: row.id, ownerId: getDemoActor().userId, label: row.label,
    kind: row.kind as PaymentAccount['kind'], holder: row.holder, institution: row.institution,
    identifier: row.identifier, masked: `${row.kind} •••• ${row.identifier.replace(/[ -]/g,'').slice(-4)}`,
    isDefault: row.is_default, updatedAt: row.updated_at };
}
export async function saveAccount(input: AccountInput, id?: string, expected?: string): Promise<string> {
  const { data, error } = await supabaseClient().rpc('save_my_payment_account', {
    p_account_id: nullable(id || null), p_expected_updated_at: nullable(expected || null),
    p_label: input.label, p_kind: input.kind, p_holder: input.holder,
    p_institution: input.institution, p_identifier: input.identifier, p_is_default: input.isDefault,
  });
  return result(data, error, 'Payment account could not be saved.');
}
export async function setDefaultAccount(id: string): Promise<void> {
  const { error } = await supabaseClient().rpc('set_my_payment_account_default', { p_account_id: id });
  result(error ? null : true, error, 'Default payment account could not be changed.');
}
export async function removeAccount(id: string): Promise<void> {
  const { error } = await supabaseClient().rpc('remove_my_payment_account', { p_account_id: id });
  result(error ? null : true, error, 'Payment account could not be removed.');
}
