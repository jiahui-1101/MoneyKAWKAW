import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './access';
import { clubPath, type ClubMember, type ActivityMembership } from './contracts';
export async function scopedDirectory(activityId: string, departmentIds: string[]) {
  const grants = await db.collection(`${clubPath}/activities/${activityId}/members`).limit(101).get();
  if (grants.size > 100) throw new HttpsError('resource-exhausted', 'Membership pagination is required.');
  const memberships: { userId: string; activityId: string; departmentId: string; role: 'HOD' | 'Member'; active: true }[] = [];
  const eligible = grants.docs.filter((doc) => (doc.data() as ActivityMembership).active === true);
  if (!eligible.length) return { users: [], memberships };
  const profiles = await db.getAll(...eligible.map((doc) => db.doc(`${clubPath}/members/${doc.id}`)));
  const users = [];
  for (let i = 0; i < eligible.length; i++) {
    const member = profiles[i].data() as ClubMember | undefined;
    if (member?.active !== true || member.uid !== eligible[i].id || !Array.isArray(member.roles)) continue;
    const grant = eligible[i].data() as ActivityMembership;
    let visible = false;
    for (const departmentId of departmentIds) {
      for (const role of ['HOD', 'Member'] as const) {
        if (member.roles.includes(role) && grant.departmentRoles?.[departmentId]?.includes(role)) {
          memberships.push({ userId: member.uid, activityId, departmentId, role, active: true });
          visible = true;
        }
      }
    }
    if (visible) users.push({ id: member.uid, name: member.name });
  }
  return { users, memberships };
}
