import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { pathToFileURL } from 'node:url';
export const projectId = 'demo-moneykawkaw';
export function requireEmulators() {
  for (const [key, port] of Object.entries({ FIRESTORE_EMULATOR_HOST: 8080,
    FIREBASE_AUTH_EMULATOR_HOST: 9099, FIREBASE_STORAGE_EMULATOR_HOST: 9199 })) {
    if (process.env[key] !== `127.0.0.1:${port}`) throw new Error(`Refusing seed: ${key} must be local.`);
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId)
    throw new Error('Refusing a non-demo project.');
}
export const people = [
  ['director', 'Director', 'Director Example'],
  ['treasurer', 'Treasurer', 'Treasurer Example'],
  ['hod', 'HOD', 'Department Head Example'],
  ['member-a', 'Member', 'Member Alpha'],
  ['member-b', 'Member', 'Member Beta'],
];
export async function seed() {
  requireEmulators();
  const app = getApps()[0] ?? initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  const auth = getAuth(app), db = getFirestore(app), root = 'clubs/main';
  const at = Timestamp.fromDate(new Date('2026-11-01T00:00:00Z'));
  const metadata = { schemaVersion: 1, revision: 1, createdAt: at, updatedAt: at, createdBy: 'emulator-seed' };
  const create = async (path, data) => db.runTransaction(async (tx) => {
    const ref = db.doc(path);
    if (!(await tx.get(ref)).exists) tx.create(ref, data);
  });
  await create(root, { ...metadata, name: 'Example Club', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', warningPercent: 80 });
  for (const [uid, role, name] of people) {
    try { await auth.getUser(uid); } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true, displayName: name });
    }
    await create(`${root}/members/${uid}`, { ...metadata, uid, name, active: true, roles: [role] });
  }
  for (const aid of ['welcome', 'restricted']) {
    await create(`${root}/activities/${aid}`, { ...metadata, name: `${aid} workshop`,
      description: 'Synthetic emulator activity', type: 'Workshop', status: 'Planning',
      startDate: '2026-12-01', endDate: '2026-12-02', budget: 100000, currency: 'MYR',
      archive: { archivedAt: null, archivedBy: null, retainUntil: null, legalHold: false } });
    for (const did of ['alpha', 'beta'])
      await create(`${root}/activities/${aid}/departments/${did}`, { ...metadata,
        activityId: aid, name: did, description: 'Synthetic department', head: did === 'alpha' ? 'Department Head Example' : '',
        hodUserId: did === 'alpha' ? 'hod' : null, allocation: 50000 });
  }
  for (const [uid, role] of people) {
    const departmentRoles = role === 'HOD' ? { alpha: ['HOD'] } :
      role === 'Member' ? { [uid === 'member-a' ? 'alpha' : 'beta']: ['Member'] } : {};
    await create(`${root}/activities/welcome/members/${uid}`,
      { ...metadata, active: true, treasurer: role === 'Treasurer', departmentRoles });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seed();
  console.log('Synthetic foundation records ready; existing records preserved.');
}
