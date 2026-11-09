import { memberNotifications } from '../domain/member-notifications';
import { requireRole } from '../domain/session';
import { memberCommand, memberData, projectMember } from './member-core';
import { memberRead } from './member-core';
import { demoMode, supabaseClient } from './supabase/client';
import { checked } from './supabase/finance';
export function readMemberNotifications(ids: string[]) {
  if (!demoMode) return (async () => {
    for (const id of ids) checked(await supabaseClient().rpc('read_financial_notification', { p_notification_id: id }));
    return { data: projectMember((await memberRead()).store), result: undefined };
  })();
  return memberCommand((store) => {
    const allowed = new Set(memberNotifications(projectMember(store)).map((n) => n.id));
    if (ids.some((id) => !allowed.has(id)))
      throw new Error('Notification unavailable for this profile.');
    const data = memberData(store),
      userId = requireRole('Member').userId;
    let entry = data.readNotifications.find((n) => n.userId === userId);
    if (!entry) {
      entry = { userId, ids: [] };
      data.readNotifications.push(entry);
    }
    entry.ids = [...new Set([...entry.ids, ...ids])].slice(-5000);
  });
}
