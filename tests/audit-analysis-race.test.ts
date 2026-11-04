import { expect, it } from 'vitest';
import { setupMember } from './member-fixture';
import { selectDemoActor } from '../src/domain/session';
import { treasuryService } from '../src/services/treasury';
import { directorService, upsertDepartment } from '../src/services/director';
const { raw } = setupMember();
it('requires fresh analysis after a budget change and retains the reviewed decision context', async () => {
  selectDemoActor('treasurer-nora');
  await treasuryService.review(
    'exp-7',
    raw().expenses.find((e) => e.id === 'exp-7')!.review!.updatedAt,
  );
  await treasuryService.analyze('exp-7');
  const original = raw().expenses.find((e) => e.id === 'exp-7')!.review!.analysis!;
  selectDemoActor('director-jamie');
  let store = await directorService.load();
  const department = store.activities
    .find((a) => a.id === 'community-day')!
    .departments.find((d) => d.id === 'community-logistics')!;
  store = upsertDepartment(
    store,
    'community-day',
    { ...department, allocation: department.allocation - 10000 },
    department.id,
  );
  await directorService.save(store);
  selectDemoActor('treasurer-nora');
  const revision = () => raw().expenses.find((e) => e.id === 'exp-7')!.review!.updatedAt;
  let failure = '';
  try {
    await treasuryService.decide('exp-7', revision(), 'Approved', 'Reviewed old snapshot');
  } catch (e) {
    failure = (e as Error).message;
  }
  expect(failure).toContain('context changed');
  expect(raw().expenses.find((e) => e.id === 'exp-7')!.state).toBe('In review');
  await treasuryService.analyze('exp-7');
  await treasuryService.decide('exp-7', revision(), 'Approved', 'Updated budget reviewed');
  expect(
    raw().expenses.find((e) => e.id === 'exp-7')!.review!.decisionAnalysis!.departmentAvailable,
  ).toBe(original.departmentAvailable - 10000);
});
