import assert from 'node:assert/strict';
import test from 'node:test';
import { admin, local, signIn, syntheticEmails } from './helpers.mjs';

test('client uploads are denied and private proof downloads require a later authorized flow', async () => {
  const { client } = await signIn(syntheticEmails.multimediaMember);
  const upload = await client.storage.from('receipts').upload('test-fixtures/blocked.png',
    new Blob(['synthetic'], { type: 'image/png' }), { contentType: 'image/png' });
  assert.ok(upload.error);
  const path = 'test-fixtures/private-proof.png';
  const created = await admin.storage.from('payment-proofs').upload(path,
    new Blob(['synthetic private proof'], { type: 'image/png' }), { contentType: 'image/png', upsert: true });
  assert.ifError(created.error);
  try {
    assert.ok((await client.storage.from('payment-proofs').download(path)).error);
  } finally {
    await admin.storage.from('payment-proofs').remove([path]);
  }
});

test('browser storage restores a session and logout clears it', async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { createClient } = await import('@supabase/supabase-js');
  const options = { auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } };
  const first = createClient(local.url, local.anonKey, options);
  const signedIn = await first.auth.signInWithPassword({ email: syntheticEmails.director, password: 'local-test-only-2026!' });
  assert.ifError(signedIn.error);
  const restored = createClient(local.url, local.anonKey, options);
  assert.equal((await restored.auth.getSession()).data.session?.user.id, signedIn.data.user.id);
  assert.equal((await restored.rpc('current_club_session')).data.roles[0], 'Director');
  await restored.auth.signOut();
  assert.equal((await restored.auth.getSession()).data.session, null);
});

test('membership revocation blocks data for an already-issued JWT', async () => {
  const { client, user } = await signIn(syntheticEmails.multimediaMember);
  const scope = (query) => query.eq('club_id', '11111111-1111-4111-8111-111111111111').eq('user_id', user.id);
  const revoke = await scope(admin.from('club_memberships').update({ status: 'revoked' }));
  assert.ifError(revoke.error);
  try {
    assert.equal((await client.from('activities').select('id')).data.length, 0);
    assert.equal((await client.rpc('current_club_session')).data, null);
    assert.equal((await client.rpc('accept_club_invitation')).data, false);
  } finally {
    const restore = await scope(admin.from('club_memberships').update({ status: 'active' }));
    assert.ifError(restore.error);
  }
});
