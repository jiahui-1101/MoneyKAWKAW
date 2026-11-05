import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { clubPath, roles, type ClubMember, type Role, type ActivityMembership } from './contracts';
initializeApp();
export const db = getFirestore();
export async function authorize(request: CallableRequest<unknown>, role?: Role): Promise<ClubMember> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  if (request.auth.token.firebase?.sign_in_provider !== 'google.com' || !request.auth.token.email_verified)
    throw new HttpsError('permission-denied', 'Use your verified Google account.');
  const snapshot = await db.doc(`${clubPath}/members/${request.auth.uid}`).get();
  const member = snapshot.data() as ClubMember | undefined;
  if (member?.active !== true || member.uid !== request.auth.uid || !Array.isArray(member.roles) ||
      typeof member.name !== 'string' || !Number.isSafeInteger(member.revision) || member.revision < 0 ||
      !member.roles.length || member.roles.some((r) => !roles.includes(r)) ||
      (role && !member.roles.includes(role)))
    throw new HttpsError('permission-denied', 'An active club invitation and role are required.');
  return member;
}
export function hasDepartment(member: ClubMember, grant: ActivityMembership | undefined,
  departmentId: string, role: 'HOD' | 'Member') {
  return member.roles.includes(role) && grant?.active === true &&
    grant.departmentRoles?.[departmentId]?.includes(role) === true;
}
export function hasTreasury(member: ClubMember, grant: ActivityMembership | undefined) {
  return member.roles.includes('Treasurer') && grant?.active === true && grant.treasurer === true;
}
