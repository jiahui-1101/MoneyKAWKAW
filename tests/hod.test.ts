import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../src/services/seed';
import { projectHod, assertHodScope } from '../src/services/hod-access';
import { selectDemoActor } from '../src/domain/session';
import { changePurchasingStatus, savePurchasingTask } from '../src/services/hod-tasks';
import { departmentBudget, isOverdue, type TaskInput } from '../src/domain/hod';
import { directorService, upsertActivity, upsertDepartment, validateStore } from '../src/services/director';
import { configureDepartmentAccess } from '../src/services/department-access';
import { upgradeSharedStore } from '../src/services/shared-migration';
import { summarize } from '../src/domain/budget';

beforeEach(() => selectDemoActor('hod-sarah'));
afterEach(() => selectDemoActor('director-jamie'));
const a = 'innovation-summit', d = 'summit-programme';
const input: TaskInput = { name: 'HDMI cable', description: 'Purchase a cable for the projector', assigneeId: 'member-ava', budget: 8000, dueDate: '2026-11-15', priority: 'Medium' };

describe('department scope and role boundaries', () => {
  it('returns only assigned scopes, eligible people, linked records, and department history', () => {
    const data = projectHod(seed);
    expect(data.scopes.map(s => s.department.id)).toEqual(['summit-programme', 'dinner-programme']);
    expect(data.scopes[0].activity).not.toHaveProperty('budget');
    expect(data.directory.users.some(u => u.id === 'member-daniel')).toBe(false);
    expect(data.expenses.map(e => e.id)).toEqual(['exp-2']);
    expect(data.events.every(e => e.departmentId === d || e.departmentId === 'dinner-programme')).toBe(true);
    expect(() => assertHodScope(seed, a, 'summit-logistics')).toThrow('access');
    expect(() => assertHodScope(seed, 'annual-dinner', d)).toThrow('access');
  });
  it('rejects Director operations and out-of-scope mutations', async () => {
    await expect(directorService.load()).rejects.toThrow('role');
    await expect(directorService.save(seed)).rejects.toThrow('role');
    await expect(directorService.reset()).rejects.toThrow('role');
    expect(() => savePurchasingTask(seed, a, 'summit-logistics', input)).toThrow('access');
    expect(() => configureDepartmentAccess(seed,a,d,'hod-sarah',[])).toThrow('role');
  });
  it('does not expose payment account metadata even if storage has additional fields', () => {
    const source = structuredClone(seed);
    Object.assign(source.expenses.find(e => e.id === 'exp-2')!, { bankAccount: 'private' });
    expect(projectHod(source).expenses[0]).not.toHaveProperty('bankAccount');
    selectDemoActor('director-jamie');
    expect(() => projectHod(seed)).toThrow('role');
  });
});
describe('purchasing budgets and progress', () => {
  it('separates plans, actual claims, commitments and available funds', () => {
    expect(departmentBudget(projectHod(seed),a,d)).toMatchObject({ budget:1200000,planned:700000,recorded:420000,open:300000,available:480000,purchasingCapacity:480000,paid:0 });
    const result=savePurchasingTask(seed,a,d,input);
    expect(departmentBudget(projectHod(result.store),a,d).available).toBe(472000);
    expect(summarize(result.store,a,d).available).toBe(472000);
    expect(result.store.expenses).toEqual(seed.expenses);
    validateStore(result.store);
  });
  it('rejects insufficient funds, foreign assignees, invalid dates, and invalid money', () => {
    expect(() => savePurchasingTask(seed,a,d,{...input,budget:480001})).toThrow('Insufficient');
    expect(() => savePurchasingTask(seed,a,d,{...input,assigneeId:'member-daniel'})).toThrow('eligible');
    expect(() => savePurchasingTask(seed,a,d,{...input,dueDate:'2026-02-30'})).toThrow('date');
    expect(() => savePurchasingTask(seed,a,d,{...input,budget:-1})).toThrow('budget');
    expect(() => savePurchasingTask(seed,a,d,{...input,budget:1.1})).toThrow('budget');
  });
  it('allows reassignment before submission and protects submitted claims and stale edits', () => {
    const created=savePurchasingTask(seed,a,d,input);
    const changed=savePurchasingTask(created.store,a,d,{...input,assigneeId:'member-ryan'},created.taskId);
    expect(changed.store.assignments[0].purchasing?.assigneeId).toBe('member-ryan');
    expect(() => savePurchasingTask(changed.store,a,d,input,created.taskId,'stale')).toThrow('changed');
    expect(() => savePurchasingTask(seed,a,d,input,'purchase-exp-2')).toThrow('submitted claim');
    expect(() => changePurchasingStatus(seed,a,d,'purchase-exp-2','Cancelled',undefined,true)).toThrow('submitted claim');
  });
  it('completes purchasing without inventing claims, approval or payment', () => {
    const result=savePurchasingTask(seed,a,d,input);
    let store=changePurchasingStatus(result.store,a,d,result.taskId,'In Progress');
    store=changePurchasingStatus(store,a,d,result.taskId,'Purchased');
    store=changePurchasingStatus(store,a,d,result.taskId,'Completed');
    expect(store.expenses).toEqual(seed.expenses); expect(store.payments).toEqual(seed.payments);
    expect(departmentBudget(projectHod(store),a,d).available).toBe(472000);
    expect(() => changePurchasingStatus(store,a,d,result.taskId,'Claim Submitted')).toThrow('transition');
  });
  it('releases cancelled plans and excludes them from overdue work', () => {
    const result=savePurchasingTask(seed,a,d,input);
    const store=changePurchasingStatus(result.store,a,d,result.taskId,'Cancelled',undefined,true);
    expect(departmentBudget(projectHod(store),a,d).available).toBe(480000);
    expect(summarize(store,a,d).available).toBe(480000);
    expect(isOverdue(store.assignments[0],'2026-12-01')).toBe(false);
    expect(isOverdue(seed.assignments.find(t => t.id==='as-2')!,'2026-11-04')).toBe(true);
  });
});
describe('Director integration and migration', () => {
  it('allows the newly assigned HOD to use a Director-created activity and department', () => {
    selectDemoActor('director-jamie');
    let store=upsertActivity(seed,{name:'Annual Dinner QA',description:'Shared setup',type:'Large-scale event',status:'Planning',startDate:'2026-12-01',endDate:'2026-12-01',budget:300000});
    const id=store.activities[0].id;
    store=upsertDepartment(store,id,{name:'Multimedia',description:'Production',head:'Sarah Tan',allocation:200000});
    const department=store.activities[0].departments[0].id;
    store=configureDepartmentAccess(store,id,department,'hod-sarah',['member-ava']);
    selectDemoActor('hod-sarah');
    const saved=savePurchasingTask(store,id,department,input).store;
    expect(departmentBudget(projectHod(saved),id,department)).toMatchObject({budget:200000,planned:8000,available:192000});
    validateStore(saved);
  });
  it('is idempotent and preserves original Director financial totals', () => {
    expect(upgradeSharedStore(seed)).toEqual(seed);
    expect(summarize(seed)).toMatchObject({budget:9800000,recorded:4565000,committed:820000,available:4835000});
  });
});
