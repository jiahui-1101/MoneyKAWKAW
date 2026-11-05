import { onCall } from 'firebase-functions/v2/https';
import { authorize } from './access';
export { foundationWorkspace } from './workspace';
// No arbitrary UID/role input is accepted. Membership is provisioned by a trusted operator.
export const sessionProfile = onCall(async (request) => {
  const member = await authorize(request);
  return { uid: member.uid, name: member.name, roles: member.roles,
    active: true, revision: member.revision, activityIds: [] };
});
