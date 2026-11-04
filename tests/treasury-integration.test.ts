import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  directorService,
  STORAGE_KEY,
  upsertActivity,
  upsertDepartment,
} from '../src/services/director';
import { configureDepartmentAccess } from '../src/services/department-access';
import { configureTreasurer } from '../src/services/treasury-access';
import { hodService } from '../src/services/hod';
import { treasuryService } from '../src/services/treasury';
import { loadDemoClaim } from '../src/services/treasury-fixtures';
import { reimbursementService } from '../src/services/reimbursements';
import { selectDemoActor } from '../src/domain/session';
import { summarize } from '../src/domain/budget';
import { seed } from '../src/services/seed';
import type { Store } from '../src/domain/models';
let values: Map<string, string>;
const raw = () => JSON.parse(values.get(STORAGE_KEY)!) as Store;
beforeEach(() => {
  values = new Map([[STORAGE_KEY, JSON.stringify(seed)]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  selectDemoActor('director-jamie');
});
afterEach(() => {
  selectDemoActor('director-jamie');
  vi.unstubAllGlobals();
});
it('preserves Director → HOD → fictional claim → Treasurer approval → proof-backed payment across shared reloads', async () => {
  let store = upsertActivity(await directorService.load(), {
    name: 'Integration Dinner',
    description: 'An integrated financial workflow.',
    type: 'Large-scale event',
    status: 'Planning',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    budget: 1000000,
  });
  const activityId = store.activities[0].id;
  store = configureTreasurer(store, activityId, true);
  store = upsertDepartment(store, activityId, {
    name: 'Multimedia',
    description: 'Event screens and sound',
    head: '',
    allocation: 200000,
  });
  const departmentId = store.activities[0].departments[0].id;
  store = configureDepartmentAccess(store, activityId, departmentId, 'hod-sarah', ['member-ava']);
  await directorService.save(store);
  selectDemoActor('hod-sarah');
  const result = await hodService.save(activityId, departmentId, {
    name: 'HDMI adapter',
    description: 'Connect event laptop to projector.',
    budget: 15000,
    assigneeId: 'member-ava',
    dueDate: '2026-11-10',
    priority: 'Medium',
  });
  expect(result.taskId).toBeTruthy();
  selectDemoActor('treasurer-nora');
  const fixture = await loadDemoClaim(
    result.taskId!,
    19000,
    'Only the compatible replacement was available; RM40 higher.',
  );
  const claimId = fixture.claimId;
  expect(summarize(fixture.data, activityId, departmentId)).toMatchObject({
    recorded: 19000,
    pending: 19000,
    available: 181000,
    committed: 0,
  });
  await expect(loadDemoClaim(result.taskId!, 19000, 'Duplicate')).rejects.toThrow('existing claim');
  let claim = raw().expenses.find((e) => e.id === claimId)!;
  const original = structuredClone(raw().treasury!.receipts.find((r) => r.expenseId === claimId));
  await treasuryService.review(claimId, claim.review!.updatedAt);
  await treasuryService.analyze(claimId);
  claim = raw().expenses.find((e) => e.id === claimId)!;
  expect(claim.review!.analysis).toMatchObject({ variance: 4000, band: 'High' });
  await treasuryService.decide(
    claimId,
    claim.review!.updatedAt,
    'Approved',
    'Reviewed compatible replacement.',
  );
  const approved = await treasuryService.load();
  expect(summarize(approved, activityId, departmentId)).toMatchObject({
    recorded: 19000,
    pending: 0,
    committed: 19000,
    available: 181000,
  });
  const date = raw().expenses.find((e) => e.id === claimId)!.date;
  await reimbursementService.record(claimId, {
    destinationRevision: (await reimbursementService.destination(claimId)).revision!,
    amount: 19000,
    date,
    reference: 'DEMO-ONLY-190',
    confirmed: true,
    proof: {
      name: 'demo-proof.pdf',
      mime: 'application/pdf',
      size: 14,
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=',
    },
  });
  const payment = raw().payments.find((p) => p.expenseId === claimId)!;
  expect(payment.manual?.receivedConfirmedAt).toBeUndefined();
  expect(raw().treasury!.receipts.find((r) => r.expenseId === claimId)).toEqual(original);
  expect((await reimbursementService.proof(payment.id)).name).toBe('demo-proof.pdf');
  const final = summarize(await treasuryService.load(), activityId, departmentId);
  expect(final).toMatchObject({
    recorded: 19000,
    paid: 19000,
    pending: 0,
    committed: 0,
    available: 181000,
  });
  selectDemoActor('hod-sarah');
  expect(
    (await hodService.department(activityId, departmentId)).expenses.find((e) => e.id === claimId)
      ?.state,
  ).toBe('Approved');
  selectDemoActor('director-jamie');
  const director = await directorService.load();
  expect(summarize(director, activityId, departmentId)).toEqual(final);
  const originalExpense = structuredClone(raw().expenses.find((e) => e.id === claimId));
  director.expenses.find((e) => e.id === claimId)!.amount = 1;
  await directorService.save(director);
  expect(raw().expenses.find((e) => e.id === claimId)).toEqual(originalExpense);
});
it('does not persist a fake success on storage failure', async () => {
  selectDemoActor('treasurer-nora');
  const before = values.get(STORAGE_KEY);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  const claim = seed.expenses.find((e) => e.id === 'exp-5')!;
  await expect(treasuryService.review(claim.id, claim.review!.updatedAt)).rejects.toThrow(
    'could not be saved',
  );
  expect(values.get(STORAGE_KEY)).toBe(before);
});
