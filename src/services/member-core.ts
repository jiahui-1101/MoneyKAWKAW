import type { Assignment, Store } from '../domain/models';
import type { MemberSnapshot } from '../domain/member';
import { getDemoActor, requireRole } from '../domain/session';
import { sharedRepository } from './director';
export function memberScope(store:Store,activityId:string,departmentId:string) {
  const actor=requireRole('Member');
  if(!store.directory?.memberships.some(m=>m.active&&m.role==='Member'&&m.userId===actor.userId&&m.activityId===activityId&&m.departmentId===departmentId))
    throw new Error('This department is outside your active Member membership.');
  return actor;
}
export function ownedTask(store:Store,id:string) {
  const task=store.assignments.find(t=>t.id===id);
  if(!task?.purchasing)throw new Error('Purchasing task unavailable.');
  const actor=memberScope(store,task.activityId,task.departmentId);
  if(task.purchasing.assigneeId!==actor.userId)throw new Error('Only the assigned member can change this task or claim its purchase.');
  return task;
}
export function ownedClaim(store:Store,id:string) {
  const claim=store.expenses.find(e=>e.id===id);
  if(!claim||claim.review?.claimantId!==requireRole('Member').userId)throw new Error('Claim unavailable for your Member profile.');
  memberScope(store,claim.activityId,claim.departmentId);return claim;
}
export function memberData(store:Store) {
  return store.member??=( {accounts:[],drafts:[],readNotifications:[]} );
}
export async function memberRead() {
  const actor=requireRole('Member');const store=await sharedRepository.load();
  if(getDemoActor().userId!==actor.userId)throw new Error('Demo profile changed. Reload your workspace.');
  requireRole('Member');return {store,actor};
}
export function projectMember(store:Store):MemberSnapshot {
  const actor=requireRole('Member');
  const memberships=store.directory!.memberships.filter(m=>m.active&&m.role==='Member'&&m.userId===actor.userId);
  const allowed=(a:string,d:string)=>memberships.some(m=>m.activityId===a&&m.departmentId===d);
  const scopes=store.activities.flatMap(a=>a.departments.filter(d=>allowed(a.id,d.id)).map(d=>({
    activity:{id:a.id,name:a.name,description:a.description,type:a.type,status:a.status,startDate:a.startDate,endDate:a.endDate},
    department:{id:d.id,name:d.name,description:d.description,head:d.head,hodUserId:d.hodUserId,allocation:d.allocation},
  })));
  const assignments=store.assignments.filter(t=>allowed(t.activityId,t.departmentId)).map(t=>({
    id:t.id,activityId:t.activityId,departmentId:t.departmentId,budget:t.budget,purchasing:t.purchasing,
    expenseId:t.purchasing?.assigneeId===actor.userId?t.expenseId:undefined,
  }));
  const ownIds=new Set(assignments.filter(t=>t.purchasing?.assigneeId===actor.userId).map(t=>t.id));
  const expenses=store.expenses.filter(e=>e.review?.claimantId===actor.userId&&allowed(e.activityId,e.departmentId)).map(e=>({
    ...e,review:e.review?{claimantId:e.review.claimantId,submittedAt:e.review.submittedAt,updatedAt:e.review.updatedAt,justification:e.review.justification,reviewer:e.review.reviewer,reviewedAt:e.review.reviewedAt,reason:e.review.reason}:undefined,
  }));
  const directoryMemberships=store.directory!.memberships.filter(m=>allowed(m.activityId,m.departmentId));
  const data=store.member;
  return structuredClone({userId:actor.userId,scopes,assignments,expenses,settings:store.settings,
    directory:{users:store.directory!.users.filter(u=>directoryMemberships.some(m=>m.userId===u.id)),memberships:directoryMemberships},
    payments:store.payments.filter(p=>expenses.some(e=>e.id===p.expenseId)).map(p=>({...p,manual:p.manual?{...p.manual,proof:{...p.manual.proof,dataUrl:''}}:undefined})),
    events:store.events.filter(e=>allowed(e.activityId,e.departmentId??'')&&!!e.assignmentId&&ownIds.has(e.assignmentId)),
    accounts:(data?.accounts??[]).filter(a=>a.ownerId===actor.userId).map(({identifier:_identifier,...a})=>a),
    drafts:(data?.drafts??[]).filter(d=>d.ownerId===actor.userId&&ownIds.has(d.taskId)).map(({receipt:_receipt,...d})=>d),
    readNotifications:data?.readNotifications.find(n=>n.userId===actor.userId)?.ids??[],
  });
}
export function memberEvent(store:Store,task:Assignment,action:string,detail:string) {
  store.events.unshift({id:crypto.randomUUID(),activityId:task.activityId,departmentId:task.departmentId,assignmentId:task.id,action,detail,actor:requireRole('Member').name,at:new Date().toISOString()});
}
let queue=Promise.resolve();
export async function memberCommand<T>(change:(store:Store)=>T) {
  const actor=requireRole('Member');
  const work=async()=>{
    if(getDemoActor().userId!==actor.userId)throw new Error('Demo profile changed.');
    const {store}=await memberRead();const result=change(store);
    await sharedRepository.save(store);return {data:projectMember(store),result};
  };
  const perform=async()=>typeof navigator!=='undefined'&&navigator.locks?await navigator.locks.request('moneykawkaw-ledger',work):await work();
  const next=queue.then(perform,perform);queue=next.then(()=>undefined,()=>undefined);return next;
}
