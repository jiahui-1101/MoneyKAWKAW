import assert from 'node:assert/strict';
import test from 'node:test';
import { admin, signIn, syntheticEmails } from './helpers.mjs';
import { ok } from './phase04-fixture.mjs';

test('payment accounts require current activity membership as well as the department grant', async () => {
  const { client, user } = await signIn(syntheticEmails.marketingMember);
  const account = ok(await client.rpc('save_my_payment_account', {
    p_account_id: null, p_expected_updated_at: null, p_label: 'Synthetic activity revocation',
    p_kind: 'Bank', p_holder: 'Synthetic Member', p_institution: 'Test Bank',
    p_identifier: '000000001234', p_is_default: false,
  }));
  const scopes = ok(await admin.from('activity_memberships').select('activity_id,status')
    .eq('user_id', user.id).eq('status', 'active'));
  assert.ok(scopes.length > 0);
  try {
    for (const scope of scopes) ok(await admin.from('activity_memberships').update({ status: 'revoked' })
      .eq('activity_id', scope.activity_id).eq('user_id', user.id));
    assert.equal(ok(await client.rpc('list_my_payment_accounts')).length, 0);
    assert.equal(ok(await client.rpc('get_my_payment_account', { p_account_id: account })).length, 0);
    const save = await client.rpc('save_my_payment_account', {
      p_account_id: null, p_expected_updated_at: null, p_label: 'Disallowed account',
      p_kind: 'Bank', p_holder: 'Synthetic Member', p_institution: 'Test Bank',
      p_identifier: '000000005678', p_is_default: false,
    });
    assert.equal(save.error?.code, '42501');
  } finally {
    for (const scope of scopes) ok(await admin.from('activity_memberships').update({ status: scope.status })
      .eq('activity_id', scope.activity_id).eq('user_id', user.id));
  }
  assert.equal(ok(await client.rpc('get_my_payment_account', { p_account_id: account })).length, 1);
});
