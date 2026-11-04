import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { treasuryService } from '../src/services/treasury';
import { reimbursementService } from '../src/services/reimbursements';
import { directorService, STORAGE_KEY } from '../src/services/director';
import { hodService } from '../src/services/hod';
import { selectDemoActor } from '../src/domain/session';
import { summarize } from '../src/domain/budget';
import { seed } from '../src/services/seed';
import type { Store } from '../src/domain/models';
import type { PaymentInput } from '../src/services/reimbursements';
const input: PaymentInput={amount:185000,date:'2026-11-05',reference:'DEMO-TRANSFER-5',confirmed:true,
  proof:{name:'proof.png',mime:'image/png',size:68,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tK0AAAAASUVORK5CYII='}};
let values: Map<string,string>;
const raw=()=>JSON.parse(values.get(STORAGE_KEY)!) as Store;
const revision=()=>raw().expenses.find(e=>e.id==='exp-5')!.review!.updatedAt;
async function approve() {
  await treasuryService.review('exp-5',revision());
  return treasuryService.decide('exp-5',revision(),'Approved','Evidence reviewed.');
}
beforeEach(()=>{
  values=new Map([[STORAGE_KEY,JSON.stringify(seed)]]);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-05T10:00:00Z'));
  selectDemoActor('treasurer-nora');
});
afterEach(()=>{selectDemoActor('director-jamie');vi.useRealTimers();vi.unstubAllGlobals();});
describe('Treasurer scope and protected evidence',()=>{
  it('returns only authorized activities, masked payment metadata and no payout or receipt files',async()=>{
    const data=await treasuryService.load();
    expect(data.activities).toHaveLength(4);expect(data.activities.some(a=>a.id==='leadership-retreat')).toBe(false);
    expect(data.treasury!.payouts).toEqual([]);expect(data.treasury!.receipts).toEqual([]);
    expect(data.expenses.some(e=>e.id==='exp-9')).toBe(false);
    await expect(treasuryService.receipt('exp-9')).rejects.toThrow('oversight');
    await expect(reimbursementService.destination('exp-5')).rejects.toThrow('approved');
    await expect(reimbursementService.destination('exp-9')).rejects.toThrow('oversight');
  });
  it('rejects other roles and rechecks grants revoked after an earlier load',async()=>{
    await treasuryService.load();const revoked=raw();revoked.treasury!.grants=[];
    values.set(STORAGE_KEY,JSON.stringify(revoked));
    await expect(treasuryService.review('exp-5',revision())).rejects.toThrow('oversight');
    selectDemoActor('hod-mei');await expect(treasuryService.receipt('exp-5')).rejects.toThrow('role');
    await expect(reimbursementService.record('exp-5',input)).rejects.toThrow('role');
  });
  it('rejects a session change during an asynchronous read',async()=>{
    const pending=treasuryService.load();selectDemoActor('director-jamie');
    await expect(pending).rejects.toThrow('changed');
  });
});
describe('review decisions and append-only evidence',()=>{
  it('requires review, records actor/reason/snapshot, preserves original evidence and rejects stale or duplicate decisions',async()=>{
    const original=structuredClone(raw().treasury!.receipts);
    await expect(treasuryService.decide('exp-5',revision(),'Approved','')).rejects.toThrow('In review');
    await treasuryService.review('exp-5',revision());
    expect(raw().expenses.find(e=>e.id==='exp-5')!.state).toBe('In review');
    await expect(treasuryService.review('exp-5',revision())).rejects.toThrow('already');
    await expect(treasuryService.decide('exp-5','stale','Approved','')).rejects.toThrow('latest');
    await expect(treasuryService.decide('exp-5',revision(),'Declined',' ')).rejects.toThrow('reason');
    await treasuryService.decide('exp-5',revision(),'Declined','Personal item needs clarification.');
    const claim=raw().expenses.find(e=>e.id==='exp-5')!;
    expect(claim.review).toMatchObject({reason:'Personal item needs clarification.',reviewer:'treasurer-nora'});
    expect(claim.review!.decisionAnalysis).toBeDefined();expect(raw().treasury!.receipts).toEqual(original);
    expect(raw().events.filter(e=>e.action==='Review started'||e.action==='Claim declined')).toHaveLength(2);
    await expect(treasuryService.decide('exp-5',revision(),'Approved','')).rejects.toThrow('latest');
    await expect(reimbursementService.record('exp-5',input)).rejects.toThrow('approved');
  });
  it('requires analysis for a departmental deficit, even when the item is within budget',async()=>{
    const expected=raw().expenses.find(e=>e.id==='exp-7')!.review!.updatedAt;
    await treasuryService.review('exp-7',expected);
    await expect(treasuryService.decide('exp-7',expected,'Approved','')).rejects.toThrow('Analyze');
    await treasuryService.analyze('exp-7');
    const claim=raw().expenses.find(e=>e.id==='exp-7')!;
    await treasuryService.decide('exp-7',claim.review!.updatedAt,'Approved','Deficit reviewed.');
    expect(raw().expenses.find(e=>e.id==='exp-7')!.review!.decisionAnalysis!.band).toBe('High');
  });
});
describe('manual reimbursement records',()=>{
  it('preserves proof and audit, exposes full snapshot only after approval, blocks concurrent duplicates and never confirms member receipt',async()=>{
    const before=summarize(await approve());
    expect((await reimbursementService.destination('exp-5')).identifier).toMatch(/^DEMO-NOT-PAYABLE/);
    const results=await Promise.allSettled([reimbursementService.record('exp-5',input),reimbursementService.record('exp-5',input)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const data=await treasuryService.load();const payment=data.payments.find(p=>p.expenseId==='exp-5')!;
    expect(payment.manual!.proof.dataUrl).toBe('');
    expect(payment.manual).toMatchObject({externalVerified:false,reference:'DEMO-TRANSFER-5',recordedBy:'treasurer-nora'});
    expect(payment.manual!.receivedConfirmedAt).toBeUndefined();
    expect(await reimbursementService.proof(payment.id)).toEqual(input.proof);
    expect(summarize(data).recorded).toBe(before.recorded);expect(summarize(data).available).toBe(before.available);
    await expect(reimbursementService.destination('exp-5')).rejects.toThrow('already');
    selectDemoActor('hod-mei');const hod=await hodService.load();expect(hod.payments.find(p=>p.id===payment.id)?.manual).toBeUndefined();
    await expect(reimbursementService.proof(payment.id)).rejects.toThrow('role');
    selectDemoActor('director-jamie');const director=await directorService.load();expect(director.payments.find(p=>p.id===payment.id)?.manual).toBeUndefined();
    await directorService.save(director);expect(raw().payments.find(p=>p.id===payment.id)!.manual!.proof).toEqual(input.proof);
  });
  it('rejects missing confirmation, mismatched amounts, future dates, missing references and spoofed proof',async()=>{
    await approve();
    for(const invalid of [{...input,confirmed:false},{...input,amount:1},{...input,date:'2099-01-01'},
      {...input,date:'2026-02-30'},{...input,reference:''},{...input,proof:{...input.proof,size:100}}])
      await expect(reimbursementService.record('exp-5',invalid)).rejects.toThrow();
    expect(raw().payments.filter(p=>p.expenseId==='exp-5')).toEqual([]);
  });
});
