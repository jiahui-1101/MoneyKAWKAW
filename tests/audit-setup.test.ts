import { expect, it } from 'vitest';
import { setupMember } from './member-fixture';
import { selectDemoActor } from '../src/domain/session';
import { directorService, upsertActivity } from '../src/services/director';
import { treasuryService } from '../src/services/treasury';
const { raw } = setupMember();
const input = {
  name: 'Concurrent setup A',
  description: 'Independent setup edit',
  type: 'Workshop' as const,
  status: 'Planning' as const,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  budget: 100000,
};
it('rejects a stale Director setup snapshot rather than discarding a different tab’s activity edit', async () => {
  selectDemoActor('director-jamie');
  const first = await directorService.load(),
    second = await directorService.load();
  await directorService.save(
    upsertActivity(first, { ...first.activities[0], name: input.name }, first.activities[0].id),
  );
  await expect(
    directorService.save(
      upsertActivity(
        second,
        { ...second.activities[1], name: 'Concurrent setup B' },
        second.activities[1].id,
      ),
    ),
  ).rejects.toThrow('changed');
  expect(raw().activities.some((a) => a.name === input.name)).toBe(true);
  expect(raw().activities.some((a) => a.name === 'Concurrent setup B')).toBe(false);
});
it('allows an unchanged setup revision after a Treasurer update and preserves the fresh claim state', async () => {
  selectDemoActor('director-jamie');
  const director = await directorService.load();
  selectDemoActor('treasurer-nora');
  const claim = raw().expenses.find((e) => e.id === 'exp-5')!;
  await treasuryService.review(claim.id, claim.review!.updatedAt);
  selectDemoActor('director-jamie');
  await directorService.save(upsertActivity(director, input));
  expect(raw().expenses.find((e) => e.id === claim.id)!.state).toBe('In review');
  expect(raw().activities[0].name).toBe(input.name);
});
