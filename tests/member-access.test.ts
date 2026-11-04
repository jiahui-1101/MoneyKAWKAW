import { expect,it,vi } from 'vitest';
import { setupMember,capturedDraft,account } from './member-fixture';
import { memberService } from '../src/services/member';
import { memberClaimService } from '../src/services/member-claims';
import { accountService } from '../src/services/member-accounts';
import { draftService } from '../src/services/member-drafts';
import { selectDemoActor } from '../src/domain/session';
import { directorService } from '../src/services/director';
import { hodService } from '../src/services/hod';
import { treasuryService } from '../src/services/treasury';
const {raw,write}=setupMember();
it('returns scoped coordination tasks but only owned claims, accounts, receipts and proof',async()=>{
  const id=(await accountService.save(account)).result;
  const data=await memberService.load();
  expect(data.scopes).toHaveLength(2);expect(data.scopes[0].activity).not.toHaveProperty('budget');
  expect(data.expenses.map(e=>e.id)).toEqual(['exp-2']);
  expect(data.accounts[0]).not.toHaveProperty('identifier');
  expect(JSON.stringify(data)).not.toContain(account.identifier);
  await expect(memberClaimService.receipt('exp-1')).rejects.toThrow('unavailable');
  await expect(memberService.proof('pay-1')).rejects.toThrow();
  selectDemoActor('member-ryan');
  await expect(accountService.detail(id)).rejects.toThrow('unavailable');
  await expect(memberClaimService.receipt('exp-2')).rejects.toThrow('unavailable');
  await expect(draftService.begin('as-2')).rejects.toThrow('assigned');
  const other=await memberService.load();
  expect(other.accounts).toHaveLength(0);
  expect(other.assignments.find(t=>t.id==='as-2')).toBeDefined();
  expect(other.assignments.find(t=>t.expenseId==='exp-2')).toBeUndefined();
});
it('rechecks membership and actor after asynchronous reads and rejects privileged APIs',async()=>{
  const pending=memberService.load();selectDemoActor('member-ryan');await expect(pending).rejects.toThrow('changed');
  await expect(hodService.load()).rejects.toThrow('role');await expect(directorService.load()).rejects.toThrow('role');await expect(treasuryService.load()).rejects.toThrow('role');
  selectDemoActor('member-ava');const data=raw();
  data.directory!.memberships.filter(m=>m.userId==='member-ava').forEach(m=>m.active=false);write(data);
  expect((await memberService.load()).scopes).toHaveLength(0);
  await expect(draftService.begin('as-2')).rejects.toThrow('membership');
});
it('keeps reassigned source work private and lets the new assignee create an independent draft',async()=>{
  const id=(await accountService.save(account)).result;
  const original=await capturedDraft();
  await draftService.preferences(original.id,original.updatedAt,id,'');
  const data=raw();data.assignments.find(t=>t.id==='as-2')!.purchasing!.assigneeId='member-ryan';write(data);
  await expect(draftService.load(original.id)).rejects.toThrow('assigned');
  await accountService.remove(id);
  selectDemoActor('member-ryan');const fresh=(await draftService.begin('as-2')).result;
  expect(fresh).not.toBe(original.id);expect((await draftService.load(fresh)).receipt).toBeUndefined();
  await expect(draftService.load(original.id)).rejects.toThrow('unavailable');
});
it('keeps private account data out of Director/HOD/Treasurer DTOs and preserves it on Director saves',async()=>{
  await accountService.save(account);await capturedDraft();
  for(const actor of ['hod-sarah','treasurer-nora','director-jamie']){
    selectDemoActor(actor);const data=actor==='hod-sarah'?await hodService.load():actor==='treasurer-nora'?await treasuryService.load():await directorService.load();
    expect(data).not.toHaveProperty('member');expect(JSON.stringify(data)).not.toContain(account.identifier);
  }
  await directorService.save(await directorService.load());expect(raw().member!.accounts[0].identifier).toBe(account.identifier);
});
it('reports quota failure and retains the prior persisted state',async()=>{
  const before=raw();vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(before),setItem:()=>{throw new Error('quota');}});
  await expect(accountService.save(account)).rejects.toThrow('could not be saved');expect(raw()).toEqual(before);
});
