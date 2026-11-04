import { analyzeClaim, claimContext, receiptLines, validateRiskRules } from '../domain/risk';
import type { RiskRules } from '../domain/treasury';
import { sharedRepository } from './director';
import { summarize } from '../domain/budget';
import { projectTreasury, scopedClaim, treasuryEvent, treasuryRead, treasuryWrite } from './treasury-core';

export const treasuryService = {
  async load() { return projectTreasury((await treasuryRead()).store); },
  async receipt(claimId: string) {
    const {store}=await treasuryRead(); scopedClaim(store,claimId);
    const receipt=store.treasury!.receipts.find(r=>r.expenseId===claimId);
    if(!receipt) throw new Error('Receipt evidence is unavailable for this legacy claim.');
    return structuredClone(receipt);
  },
  review(claimId: string, expected: string) {
    return treasuryWrite(async()=> {
      const {store,actor}=await treasuryRead(); const claim=scopedClaim(store,claimId);
      if(claim.state!=='Pending review' || claim.review?.updatedAt!==expected) throw new Error('Claim changed or review already started. Refresh the queue.');
      claim.state='In review'; claim.review.reviewer=actor.userId; claim.review.updatedAt=new Date().toISOString();
      treasuryEvent(store,claimId,'Review started','Pending review → In review');
      await sharedRepository.save(store); return projectTreasury(store);
    });
  },
  analyze(claimId: string) {
    return treasuryWrite(async()=> {
      const {store,actor}=await treasuryRead(); const claim=scopedClaim(store,claimId);
      if(!['Pending review','In review'].includes(claim.state)) throw new Error('Final decisions retain their original analysis.');
      claim.review!.analysis=analyzeClaim(store,claim,actor.name);
      claim.review!.updatedAt=new Date().toISOString();
      treasuryEvent(store,claimId,'Risk analysis recorded',`${claim.review!.analysis.band} · rule-based advisory analysis`);
      await sharedRepository.save(store); return projectTreasury(store);
    });
  },
  decide(claimId: string, expected: string, decision: 'Approved'|'Declined', reason: string) {
    return treasuryWrite(async()=> {
      const {store,actor}=await treasuryRead(); const claim=scopedClaim(store,claimId);
      if(!['Approved','Declined'].includes(decision) || claim.state!=='In review' || claim.review?.updatedAt!==expected)
        throw new Error('A decision requires the latest In review claim. Refresh before deciding.');
      if(reason.length>1000 || (decision==='Declined' && !reason.trim())) throw new Error('A decline reason is required (up to 1,000 characters).');
      const receipt=store.treasury!.receipts.find(r=>r.expenseId===claimId);
      if(decision==='Approved' && (!receipt || receiptLines(receipt).filter(l=>!l.excluded).reduce((s,l)=>s+l.final.amount,0)!==claim.amount))
        throw new Error('Receipt lines must reconcile to the submitted amount before approval.');
      const overBudget=claimContext(store,claim).variance>0 || summarize(store,claim.activityId,claim.departmentId).available<0 || summarize(store,claim.activityId).available<0;
      if(decision==='Approved' && overBudget && !claim.review.analysis)
        throw new Error('Analyze the over-budget claim before approval.');
      if(decision==='Approved' && claimContext(store,claim).variance>0 && !claim.review.justification.trim())
        throw new Error('An over-budget claim requires the member’s justification.');
      const at=new Date().toISOString();
      claim.review.decisionAnalysis=analyzeClaim(store,claim,actor.name);
      claim.state=decision;
      Object.assign(claim.review,{reviewer:actor.userId,reviewedAt:at,updatedAt:at,reason:reason.trim()});
      treasuryEvent(store,claimId,`Claim ${decision.toLowerCase()}`,`In review → ${decision}. ${reason.trim() || 'Evidence reviewed.'} Approval is separate from payment.`);
      await sharedRepository.save(store); return projectTreasury(store);
    });
  },
  rules(rules: RiskRules) {
    return treasuryWrite(async()=> {
      const {store}=await treasuryRead(); validateRiskRules(rules);
      store.treasury!.rules=structuredClone(rules);
      const claim=projectTreasury(store).expenses[0];
      if(claim) treasuryEvent(store,claim.id,'Risk thresholds updated',JSON.stringify(rules));
      await sharedRepository.save(store); return projectTreasury(store);
    });
  },
};
