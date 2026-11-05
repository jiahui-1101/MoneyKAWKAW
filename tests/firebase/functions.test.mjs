import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { seed, projectId } from '../../scripts/seed-emulators.mjs';
const root = 'clubs/main';
before(seed);
async function google(uid) {
  const body = { requestUri: 'http://localhost', returnSecureToken: true,
    postBody: new URLSearchParams({ providerId: 'google.com', id_token: JSON.stringify({
      sub: uid, email: `${uid}@example.test`, email_verified: true, name: uid }) }).toString() };
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=emulator-only',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json();
  assert.equal(response.status, 200, JSON.stringify(value));
  return value.idToken;
}
async function call(name, token, data = {}) {
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }) });
  return { status: response.status, ...await response.json() };
}
test('callables require verified Google sign-in and explicit club membership', async () => {
  assert.equal((await call('sessionProfile')).status, 401);
  assert.equal((await call('sessionProfile', await google('outsider'))).status, 403);
  for (const [uid, role] of [['director','Director'],['treasurer','Treasurer'],['hod','HOD'],['member-a','Member']]) {
    const response = await call('sessionProfile', await google(uid));
    assert.equal(response.status, 200, JSON.stringify(response));
    assert.deepEqual(response.result.roles, [role]);
    assert.equal(response.result.uid, uid);
  }
});
test('workspace projections enforce role, activity and department scope on the server', async () => {
  const member = await google('member-a');
  assert.equal((await call('foundationWorkspace', member, { role: 'Director' })).status, 403);
  assert.equal((await call('foundationWorkspace', member, { role: 'Administrator' })).status, 400);
  const response = await call('foundationWorkspace', member, { role: 'Member', uid: 'director', departmentId: 'beta' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.result.activities.map((a) => a.id), ['welcome']);
  assert.deepEqual(response.result.activities[0].departments.map((d) => d.id), ['alpha']);
  assert.equal(response.result.activities[0].budget, 0);
  assert.deepEqual(response.result.directory.users.map((u) => u.id).sort(), ['hod', 'member-a']);
  assert.equal(response.result.directory.memberships.some((m) => m.departmentId === 'beta'), false);
  assert.equal(response.result.directory.users.some((u) => 'email' in u || 'roles' in u), false);
  assert.deepEqual(response.result.member.accounts, []);
  const hod = await call('foundationWorkspace', await google('hod'), { role: 'HOD' });
  assert.deepEqual(hod.result.activities[0].departments.map((d) => d.id), ['alpha']);
  const treasury = await call('foundationWorkspace', await google('treasurer'), { role: 'Treasurer' });
  assert.deepEqual(treasury.result.activities.map((a) => a.id), ['welcome']);
  assert.equal(treasury.result.activities[0].budget, 100000);
  const director = await call('foundationWorkspace', await google('director'), { role: 'Director' });
  assert.equal(director.result.activities.length, 2);
});
test('membership and grant revocation take effect with an existing identity token', async () => {
  const db = getFirestore(), uid = 'revocation-test';
  try { await getAuth().deleteUser((await getAuth().getUserByEmail(`${uid}@example.test`)).uid); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  await getAuth().createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
  const token = await google(uid);
  const member = db.doc(`${root}/members/${uid}`), grant = db.doc(`${root}/activities/welcome/members/${uid}`);
  await member.set({ uid, name: 'Synthetic Revocation', active: true, roles: ['HOD'], revision: 1 });
  await grant.set({ active: true, treasurer: false, departmentRoles: { alpha: ['HOD'] } });
  assert.equal((await call('foundationWorkspace', token, { role: 'HOD' })).result.activities.length, 1);
  await grant.update({ active: false });
  assert.equal((await call('foundationWorkspace', token, { role: 'HOD' })).result.activities.length, 0);
  await member.update({ active: false });
  assert.equal((await call('sessionProfile', token)).status, 403);
  assert.equal((await call('foundationWorkspace', token, { role: 'HOD' })).status, 403);
});
test('seed is idempotent and preserves existing memberships and preferences', async () => {
  const db = getFirestore(), ref = db.doc(`${root}/members/member-b/preferences/notifications`);
  await ref.set({ notificationEnabled: false });
  const before = (await db.doc(`${root}/members/director`).get()).data();
  await seed();
  assert.deepEqual((await db.doc(`${root}/members/director`).get()).data(), before);
  assert.equal((await ref.get()).data().notificationEnabled, false);
});
test('invalid fractional monetary source data is rejected before reaching dashboards', async () => {
  const ref = getFirestore().doc(`${root}/activities/invalid-budget`);
  try {
    await ref.set({ budget: 1.5, currency: 'MYR' });
    const result = await call('foundationWorkspace', await google('director'), { role: 'Director' });
    assert.equal(result.status, 400);
    assert.equal(result.error.status, 'FAILED_PRECONDITION');
  } finally { await ref.delete(); }
});
