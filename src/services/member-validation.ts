import type { Store } from '../domain/models';
import { validateAccount } from '../domain/accounts';
import { validateReceiptEvidence } from './receipt-validation';
export function validateMemberData(store:Store) {
  validateMemberPayments(store);
  const data=store.member;if(!data)return;
  if(![data.accounts,data.drafts,data.readNotifications].every(Array.isArray))throw new Error('Invalid Member workspace data.');
  const unique=(records:{id:string}[])=>records.every(r=>typeof r.id==='string'&&r.id.length>0)&&new Set(records.map(r=>r.id)).size===records.length;
  if(!unique(data.accounts)||!unique(data.drafts))throw new Error('Duplicate Member record identifiers.');
  for(const a of data.accounts){
    validateAccount(a);
    if(!store.directory?.users.some(u=>u.id===a.ownerId)||!a.masked||a.masked.includes(a.identifier)||Number.isNaN(Date.parse(a.updatedAt)))throw new Error('Invalid payment account ownership or masking.');
  }
  for(const owner of new Set(data.accounts.map(a=>a.ownerId)))if(data.accounts.filter(a=>a.ownerId===owner&&a.isDefault).length!==1)throw new Error('Each account owner needs one default destination.');
  for(const draft of data.drafts){
    if(!store.directory?.users.some(u=>u.id===draft.ownerId)||!store.assignments.some(t=>t.id===draft.taskId)||typeof draft.accountId!=='string'||typeof draft.justification!=='string'||draft.justification.length>1000||Number.isNaN(Date.parse(draft.updatedAt)))throw new Error('Invalid claim draft.');
    if(draft.receipt)validateReceiptEvidence(draft.receipt);
  }
  if(new Set(data.drafts.map(d=>`${d.ownerId}:${d.taskId}`)).size!==data.drafts.length)throw new Error('Only one draft per owner is allowed for a purchasing task.');
  for(const read of data.readNotifications)if(!store.directory?.users.some(u=>u.id===read.userId)||!Array.isArray(read.ids)||read.ids.some(id=>typeof id!=='string'))throw new Error('Invalid notification read state.');
}
function validateMemberPayments(store:Store) {
  for(const p of store.payments){
    const m=p.manual;if(!m)continue;
    const claim=store.expenses.find(e=>e.id===p.expenseId)!;
    if(m.receivedConfirmedAt&&(m.receivedConfirmedBy!==claim.review?.claimantId||Number.isNaN(Date.parse(m.receivedConfirmedAt))))throw new Error('Receipt confirmation must belong to the claimant.');
    if(m.discrepancy?.resolvedAt&&(!m.receivedConfirmedAt||m.discrepancy.resolvedBy!==claim.review?.claimantId))throw new Error('A discrepancy resolution requires the claimant’s receipt acknowledgment.');
    if(m.discrepancy&&(m.discrepancy.reportedBy!==claim.review?.claimantId||!m.discrepancy.reason.trim()||Number.isNaN(Date.parse(m.discrepancy.reportedAt))||
      (m.discrepancy.receivedAmount!==undefined&&(!Number.isSafeInteger(m.discrepancy.receivedAmount)||m.discrepancy.receivedAmount<0))))throw new Error('Invalid payment discrepancy record.');
  }
}
