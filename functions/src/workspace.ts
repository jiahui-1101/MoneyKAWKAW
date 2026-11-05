import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { authorize, db, hasDepartment, hasTreasury } from './access';
import { scopedDirectory } from './directory';
import { callableOptions } from './options';
import { clubPath, roles, validSen, type Role, type ActivityMembership, type ActivityRecord, type DepartmentRecord, type ClubProfile } from './contracts';
export const foundationWorkspace = onCall(callableOptions, async (request) => {
  const role = request.data?.role as Role;
  if (!roles.includes(role)) throw new HttpsError('invalid-argument', 'Choose an assigned workspace.');
  const member = await authorize(request, role);
  const club = (await db.doc(clubPath).get()).data() as ClubProfile | undefined;
  if (!club || club.currency !== 'MYR') throw new HttpsError('failed-precondition', 'Club configuration is unavailable.');
  const activities = [], memberships = [], grants = [];
  const users = new Map([[member.uid, { id: member.uid, name: member.name }]]);
  const profiles = new Map([[member.uid, member]]);
  const documents = await db.collection(`${clubPath}/activities`).limit(101).get();
  if (documents.size > 100) throw new HttpsError('resource-exhausted', 'Activity pagination is required.');
  for (const document of documents.docs) {
    const activity = document.data() as ActivityRecord;
    const grant = (await document.ref.collection('members').doc(member.uid).get()).data() as ActivityMembership | undefined;
    const finance = role === 'Director' || (role === 'Treasurer' && hasTreasury(member, grant));
    if (!finance && !grant?.active) continue;
    if (!validSen(activity.budget) || activity.currency !== 'MYR')
      throw new HttpsError('failed-precondition', 'Activity budget data needs administrator review.');
    const departmentDocs = await document.ref.collection('departments').get();
    const departments = [];
    for (const d of departmentDocs.docs) {
      const dep = d.data() as DepartmentRecord;
      const allowed = (role === 'HOD' || role === 'Member') && hasDepartment(member, grant, d.id, role);
      if (!finance && !allowed) continue;
      if (!validSen(dep.allocation))
        throw new HttpsError('failed-precondition', 'Department budget data needs administrator review.');
      departments.push({ id: d.id, name: dep.name, description: dep.description,
        head: dep.head, hodUserId: dep.hodUserId ?? undefined, allocation: dep.allocation });
    }
    if (!finance && !departments.length) continue;
    const directory = await scopedDirectory(document.id, departments.map((d) => d.id), profiles);
    memberships.push(...directory.memberships);
    directory.users.forEach((user) => users.set(user.id, user));
    if (role === 'Treasurer') grants.push({ userId: member.uid, activityId: document.id });
    activities.push({ id: document.id, name: activity.name, description: activity.description,
      type: activity.type, status: activity.status, startDate: activity.startDate,
      endDate: activity.endDate, budget: finance ? activity.budget : 0, departments });
  }
  // Explicit field projection: never return arbitrary Admin SDK document spreads.
  // Business collections are intentionally not loaded or mutated in Phase 01.
  await authorize(request, role);
  return { version: 1, setupRevision: 0, activities, expenses: [], payments: [], assignments: [],
    events: [], settings: { currency: club.currency, timezone: club.timezone, warningPercent: club.warningPercent ?? 80 },
    directory: { users: [...users.values()], memberships },
    member: { accounts: [], drafts: [], readNotifications: [] },
    treasury: { grants, receipts: [], payouts: [],
      rules: { mediumVariance: 10, highVariance: 25, lowHeadroomPercent: 10 } } };
});
