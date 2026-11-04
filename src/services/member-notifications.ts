import { memberNotifications } from '../domain/member-notifications';
import { requireRole } from '../domain/session';
import { memberCommand, memberData, projectMember } from './member-core';
export function readMemberNotifications(ids:string[]) {
  return memberCommand(store=>{
    const allowed=new Set(memberNotifications(projectMember(store)).map(n=>n.id));
    if(ids.some(id=>!allowed.has(id)))throw new Error('Notification unavailable for this profile.');
    const data=memberData(store),userId=requireRole('Member').userId;
    let entry=data.readNotifications.find(n=>n.userId===userId);
    if(!entry){entry={userId,ids:[]};data.readNotifications.push(entry);}
    entry.ids=[...new Set([...entry.ids,...ids])].slice(-5000);
  });
}
