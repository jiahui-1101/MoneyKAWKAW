import type { PurchasingStatus } from '../domain/models';
import { memberCommand, memberEvent, memberRead, ownedClaim, ownedTask, projectMember } from './member-core';
export const memberService={
  async load(){return projectMember((await memberRead()).store);},
  progress(id:string,expected:string,status:PurchasingStatus) {
    return memberCommand(store=>{
      const task=ownedTask(store,id),p=task.purchasing!;
      if(task.expenseId||p.updatedAt!==expected||p.status==='Cancelled')throw new Error('This task changed or already has a claim. Reload before updating.');
      const next:Partial<Record<PurchasingStatus,PurchasingStatus[]>>={'Not Started':['In Progress','Purchased'],'In Progress':['Purchased'],Purchased:['Completed']};
      if(!next[p.status]?.includes(status))throw new Error('This purchasing transition is not available. Purchase progress never approves or pays a claim.');
      const before=p.status;p.status=status;p.updatedAt=new Date().toISOString();
      memberEvent(store,task,'Member purchase progress updated',`${p.name} · ${before} → ${status}. Claim and payment remain separate.`);
    });
  },
  async proof(paymentId:string) {
    const {store}=await memberRead();const payment=store.payments.find(p=>p.id===paymentId);
    if(!payment)throw new Error('Payment unavailable for your profile.');ownedClaim(store,payment.expenseId);
    if(!payment.manual?.proof)throw new Error('No proof was retained for this historical payment.');return structuredClone(payment.manual.proof);
  },
  confirm(paymentId:string,amountReceived:number,confirmed:boolean) {
    return memberCommand(store=>{
      const payment=store.payments.find(p=>p.id===paymentId);
      if(!payment)throw new Error('Payment unavailable.');const claim=ownedClaim(store,payment.expenseId),manual=payment.manual;
      if(claim.state!=='Approved'||!manual?.proof||manual.receivedConfirmedAt||payment.amount!==claim.amount)throw new Error('Only one full recorded manual reimbursement can be confirmed once.');
      if(!confirmed||amountReceived!==payment.amount)throw new Error('Confirm the full recorded amount only after receiving it. Report a discrepancy if the amount differs.');
      const at=new Date().toISOString(),actor=claim.review!.claimantId!;
      manual.receivedConfirmedAt=at;manual.receivedConfirmedBy=actor;
      if(manual.discrepancy){manual.discrepancy.resolvedAt=at;manual.discrepancy.resolvedBy=actor;}
      const task=store.assignments.find(t=>t.expenseId===claim.id)!;task.purchasing!.status='Completed';task.purchasing!.updatedAt=at;
      memberEvent(store,task,'Receipt confirmed',`${claim.id} · member acknowledged ${(payment.amount/100).toFixed(2)} ${store.settings.currency} received. Any prior discrepancy is retained as resolved by this acknowledgment.`);
    });
  },
  discrepancy(paymentId:string,reason:string,receivedAmount?:number) {
    return memberCommand(store=>{
      const payment=store.payments.find(p=>p.id===paymentId);
      if(!payment)throw new Error('Payment unavailable.');const claim=ownedClaim(store,payment.expenseId),manual=payment.manual;
      if(!manual||manual.receivedConfirmedAt||manual.discrepancy)throw new Error('Report an issue only for an unconfirmed manual payment without an existing report.');
      if(reason.trim().length<3||reason.length>1000||(receivedAmount!==undefined&&(!Number.isSafeInteger(receivedAmount)||receivedAmount<0||receivedAmount>100_000_000_000)))throw new Error('Describe the discrepancy in 3–1,000 characters and use a valid received amount.');
      manual.discrepancy={reason:reason.trim(),receivedAmount,reportedAt:new Date().toISOString(),reportedBy:claim.review!.claimantId!};
      memberEvent(store,store.assignments.find(t=>t.expenseId===claim.id)!,'Payment discrepancy reported',`${claim.id} · ${reason.trim()}. Receipt remains unconfirmed.`);
    });
  },
};
