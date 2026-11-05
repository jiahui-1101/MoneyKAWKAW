import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { seed, projectId } from '../../scripts/seed-emulators.mjs';
let env;
const root = 'clubs/main', activity = root + '/activities/welcome';
const token = { email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const as = (uid) => env.authenticatedContext(uid, token).firestore();
before(async () => {
  await seed();
  env = await initializeTestEnvironment({ projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, did, owner] of [['a','alpha','member-a'],['b','beta','member-b']]) {
      await setDoc(doc(db, activity, 'assignments', id), { departmentId: did, assigneeUid: owner });
      await setDoc(doc(db, activity, 'claims', id), { departmentId: did, claimantUid: owner, amount: 100 });
      await setDoc(doc(db, activity, 'receipts', id), { departmentId: did, ownerUid: owner });
      await setDoc(doc(db, root, 'members', owner, 'payoutMethods', 'one'), { masked: '•••• 0000' });
    }
    await uploadBytes(ref(ctx.storage(), 'private/proof.png'), new Uint8Array([1,2,3]));
  });
});
after(async () => { await env?.cleanup(); });
test('Google authentication alone does not grant club access', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), as('outsider'),
    env.authenticatedContext('director', { ...token, firebase: { sign_in_provider: 'password' } }).firestore()]) {
    await assertFails(getDoc(doc(db, root)));
    await assertFails(getDoc(doc(db, activity)));
  }
});
test('role and department scope apply to direct document reads and queries', async () => {
  await assertSucceeds(getDoc(doc(as('director'), activity)));
  await assertSucceeds(getDoc(doc(as('treasurer'), activity)));
  await assertFails(getDoc(doc(as('treasurer'), root, 'activities/restricted')));
  for (const uid of ['hod','member-a']) {
    await assertSucceeds(getDoc(doc(as(uid), activity, 'departments/alpha')));
    await assertFails(getDoc(doc(as(uid), activity, 'departments/beta')));
    await assertSucceeds(getDoc(doc(as(uid), activity, 'assignments/a')));
    await assertFails(getDoc(doc(as(uid), activity, 'assignments/b')));
    await assertFails(getDocs(collection(as(uid), activity, 'assignments')));
    await assertSucceeds(getDocs(query(collection(as(uid), activity, 'assignments'), where('departmentId','==','alpha'))));
  }
});
test('private claims, receipts and masked accounts never leak to peers or HOD', async () => {
  for (const kind of ['claims','receipts']) {
    await assertSucceeds(getDoc(doc(as('member-a'), activity, kind, 'a')));
    await assertSucceeds(getDoc(doc(as('treasurer'), activity, kind, 'a')));
    for (const uid of ['member-b','hod','director'])
      await assertFails(getDoc(doc(as(uid), activity, kind, 'a')));
  }
  await assertFails(getDoc(doc(as('member-a'), root, 'members/member-b/payoutMethods/one')));
  await assertFails(getDoc(doc(as('treasurer'), root, 'members/member-a/payoutMethods/one')));
  await assertFails(getDoc(doc(as('director'), root, 'paymentSecrets/one')));
});
test('financial CRUD and role escalation are denied even for Director', async () => {
  for (const uid of ['director','treasurer','hod','member-a','outsider']) {
    const db = as(uid);
    await assertFails(setDoc(doc(db, root, 'members', uid), { active: true, roles: ['Director'] }));
    for (const path of ['claims/a','assignments/a','departments/alpha','audit/injected']) {
      await assertFails(setDoc(doc(db, activity, path), { amount: 999 }));
      await assertFails(updateDoc(doc(db, activity, path), { amount: 999 }));
      await assertFails(deleteDoc(doc(db, activity, path)));
    }
  }
});
test('own preference CRUD validates schema, timestamp, and immutable scope', async () => {
  const db = as('member-a'), path = root + '/members/member-a/preferences/notifications';
  await assertSucceeds(setDoc(doc(db, path), { notificationEnabled: true, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db, path), { notificationEnabled: false, updatedAt: serverTimestamp() }));
  assert.equal((await getDoc(doc(db, path))).data().notificationEnabled, false);
  await assertFails(updateDoc(doc(db, path), { roles: ['Director'], updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, path), { notificationEnabled: 'yes', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db, path)));
  await assertFails(getDoc(doc(as('member-b'), path)));
});
test('Storage reads, lists, uploads and deletions stay closed until evidence phase', async () => {
  for (const uid of ['director','treasurer','hod','member-a','outsider']) {
    const storage = env.authenticatedContext(uid, token).storage();
    await assertFails(getBytes(ref(storage, 'private/proof.png')));
    await assertFails(uploadBytes(ref(storage, 'private/new.png'), new Uint8Array([1])));
    await assertFails(deleteObject(ref(storage, 'private/proof.png')));
    await assertFails(listAll(ref(storage, 'private')));
  }
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'private/proof.png')));
});
test('unverified Google accounts and inactive memberships fail closed', async () => {
  const unverified = env.authenticatedContext('director', { ...token, email_verified: false }).firestore();
  await assertFails(getDoc(doc(unverified, root)));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), root, 'members/inactive'), { uid: 'inactive', active: false, roles: ['Director'] });
    await setDoc(doc(ctx.firestore(), root, 'members/malformed'), { uid: 'someone-else', active: true, roles: ['Director'] });
  });
  for (const uid of ['inactive', 'malformed']) await assertFails(getDoc(doc(as(uid), activity)));
});
test('receipt history, payment proof metadata and drafts retain parent ownership and scope', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const path of ['claims/a/payments/one', 'receipts/a/extractions/original', 'receipts/a/edits/one'])
      await setDoc(doc(ctx.firestore(), activity, path), { synthetic: true });
    await setDoc(doc(ctx.firestore(), root, 'members/member-a/drafts/foreign'), { activityId: 'welcome', departmentId: 'beta' });
  });
  for (const path of ['claims/a/payments/one', 'receipts/a/extractions/original', 'receipts/a/edits/one']) {
    await assertSucceeds(getDoc(doc(as('member-a'), activity, path)));
    for (const uid of ['member-b', 'hod', 'director']) await assertFails(getDoc(doc(as(uid), activity, path)));
  }
  await assertFails(getDoc(doc(as('member-a'), root, 'members/member-a/drafts/foreign')));
});
