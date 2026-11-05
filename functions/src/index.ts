import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { authorize, db } from './access';
import { clubPath } from './contracts';
import { callableOptions } from './options';
export { foundationWorkspace } from './workspace';
// No arbitrary UID/role input is accepted. Membership is provisioned by a trusted operator.
export const sessionProfile = onCall(callableOptions, async (request) => {
  const member = await authorize(request);
  const club = (await db.doc(clubPath).get()).data();
  if (typeof club?.name !== 'string') throw new HttpsError('failed-precondition', 'Club profile is unavailable.');
  return { uid: member.uid, name: member.name, roles: member.roles,
    active: true, revision: member.revision, clubName: club.name };
});
