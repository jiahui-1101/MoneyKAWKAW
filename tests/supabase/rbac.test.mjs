import assert from 'node:assert/strict';
import test from 'node:test';
import { anonymous, signIn, syntheticEmails, userId } from './helpers.mjs';

async function rows(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

test('anonymous and uninvited users cannot read club data', async () => {
  const anonymousRead = await anonymous.from('activities').select('id');
  assert.equal(anonymousRead.data, null);
  assert.ok(anonymousRead.error);
  const { client } = await signIn(syntheticEmails.uninvited);
  assert.equal((await client.rpc('current_club_session')).data, null);
  assert.equal((await rows(client.from('activities').select('id'))).length, 0);
  assert.equal((await rows(client.from('club_memberships').select('club_id'))).length, 0);
});

test('Director and Treasurer receive club-wide foundation rows', async () => {
  for (const [email, role] of [[syntheticEmails.director, 'Director'], [syntheticEmails.treasurer, 'Treasurer']]) {
    const { client } = await signIn(email);
    const session = await client.rpc('current_club_session');
    assert.ok(session.data.roles.includes(role));
    assert.equal((await rows(client.from('activities').select('id'))).length, 2);
    assert.equal((await rows(client.from('departments').select('id'))).length, 3);
    assert.equal((await rows(client.from('profiles').select('user_id'))).length, 6);
  }
});

test('HOD sees assigned department and same-department roster only', async () => {
  const { client } = await signIn(syntheticEmails.multimediaHod);
  assert.equal((await rows(client.from('activities').select('id'))).length, 1);
  assert.deepEqual((await rows(client.from('departments').select('name'))).map((row) => row.name), ['Multimedia']);
  assert.equal((await rows(client.from('profiles').select('display_name'))).length, 2);
  const crossDepartment = await client.from('departments').select('id').eq('id', '33333333-3333-4333-8333-333333333333');
  assert.deepEqual(crossDepartment.data, []);
});

test('Committee Member sees own profile and cannot query another department', async () => {
  const { client, user } = await signIn(syntheticEmails.multimediaMember);
  assert.equal((await rows(client.from('profiles').select('user_id'))).length, 1);
  assert.equal((await rows(client.from('department_memberships').select('department_id'))).length, 1);
  const otherId = await userId(syntheticEmails.communityMember);
  assert.deepEqual((await client.from('profiles').select('user_id').eq('user_id', otherId)).data, []);
  assert.deepEqual((await client.from('departments').select('id')
    .eq('id', '33333333-3333-4333-8333-333333333333')).data, []);
  assert.equal(user.email, syntheticEmails.multimediaMember);
});

test('client role and department-scope escalation are denied', async () => {
  const { client, user } = await signIn(syntheticEmails.multimediaMember);
  assert.ok((await client.from('club_role_grants').update({ role: 'Director' }).eq('user_id', user.id)).error);
  const forged = await client.from('department_memberships').insert({
    department_id: '33333333-3333-4333-8333-333333333332', activity_id: '22222222-2222-4222-8222-222222222221',
    club_id: '11111111-1111-4111-8111-111111111111', user_id: user.id, role: 'HOD',
  });
  assert.ok(forged.error);
});
