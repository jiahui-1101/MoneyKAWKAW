import { expect, it } from 'vitest';
import { setupMember } from './member-fixture';
import { selectDemoActor, getDemoActor } from '../src/domain/session';
import { directorService } from '../src/services/director';
import { hodService } from '../src/services/hod';
import { treasuryService } from '../src/services/treasury';
import { memberService } from '../src/services/member';
import { reimbursementService } from '../src/services/reimbursements';
const { raw } = setupMember();
it.each(['director-jamie', 'hod-sarah', 'member-ava', 'treasurer-nora'])(
  'rejects unauthorized mutation commands without writing for %s',
  async (actor) => {
    selectDemoActor(actor);
    const before = raw(),
      role = getDemoActor().role;
    if (role !== 'Director') await expect(directorService.save(before)).rejects.toThrow('role');
    if (role !== 'HOD')
      await expect(
        hodService.save('innovation-summit', 'summit-programme', {
          name: 'Forged',
          description: 'Unauthorized task',
          budget: 100,
          assigneeId: 'member-ava',
          dueDate: '2026-11-10',
          priority: 'Low',
        }),
      ).rejects.toThrow('role');
    if (role !== 'Treasurer') {
      await expect(treasuryService.decide('exp-5', 'stale', 'Approved', 'Forged')).rejects.toThrow(
        'role',
      );
      await expect(reimbursementService.resolveIssue('pay-1', 'Forged response')).rejects.toThrow(
        'role',
      );
    }
    if (role !== 'Member') {
      await expect(memberService.confirm('pay-1', 880000, true)).rejects.toThrow('role');
      await expect(memberService.progress('as-2', 'stale', 'Completed')).rejects.toThrow('role');
    }
    expect(raw()).toEqual(before);
  },
);
it('does not accept a forged role/profile identifier', () => {
  const before = getDemoActor();
  expect(() => selectDemoActor('admin-treasurer')).toThrow('available');
  expect(getDemoActor()).toEqual(before);
});
