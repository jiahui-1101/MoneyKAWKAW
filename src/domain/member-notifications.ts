import type { MemberSnapshot } from './member';
import { departmentToday } from './hod';
export interface MemberNotification {id:string;title:string;detail:string;at:string;to:string;tone:string;read:boolean}
export function memberNotifications(data:MemberSnapshot):MemberNotification[] {
  const today=departmentToday(data.settings.timezone),notes:Omit<MemberNotification,'read'>[]=[];
  const tasks=data.assignments.filter(t=>t.purchasing?.assigneeId===data.userId);
  for(const task of tasks){
    const p=task.purchasing!;
    const creation=data.events.find(e=>e.assignmentId===task.id&&e.action==='Purchasing task created');
    notes.push({id:`assigned-${task.id}`,title:'A purchase is assigned to you',detail:p.name,at:creation?.at??p.updatedAt,to:`/member/tasks/${task.id}`,tone:'brand'});
    const days=(Date.parse(`${p.dueDate}T12:00:00Z`)-Date.parse(`${today}T12:00:00Z`))/86400000;
    if(['Not Started','In Progress'].includes(p.status)&&days<=7)
      notes.push({id:`deadline-${task.id}-${p.dueDate}`,title:days<0?'Purchase deadline overdue':days===0?'Purchase due today':'Purchase deadline approaching',detail:`${p.name} · due ${p.dueDate}`,at:`${today}T00:00:00Z`,to:`/member/tasks/${task.id}`,tone:days<0?'danger':'gold'});
  }
  const actions=['Claim submitted','Review started','Claim approved','Claim declined','Manual reimbursement recorded','Receipt confirmed','Payment discrepancy reported','Payout destination changed'];
  for(const event of data.events.filter(e=>actions.includes(e.action))){
    const claim=data.expenses.find(e=>data.assignments.find(t=>t.expenseId===e.id)?.id===event.assignmentId);
    if(claim)notes.push({id:event.id,title:event.action,detail:claim.description,at:event.at,to:`/member/claims/${claim.id}`,tone:claim.state==='Declined'?'danger':'brand'});
  }
  for(const payment of data.payments.filter(p=>p.manual&&!p.manual.receivedConfirmedAt)){
    const claim=data.expenses.find(e=>e.id===payment.expenseId)!;
    notes.push({id:`confirmation-${payment.id}`,title:payment.manual!.discrepancy?'Payment issue remains open':'Payment proof available · receipt confirmation needed',detail:claim.description,at:payment.manual!.recordedAt,to:`/member/claims/${claim.id}/payment`,tone:payment.manual!.discrepancy?'danger':'green'});
  }
  return notes.map(n=>({...n,read:data.readNotifications.includes(n.id)})).sort((a,b)=>b.at.localeCompare(a.at));
}
