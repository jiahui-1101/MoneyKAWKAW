import { expect, it } from 'vitest';
import { setupMember, proof } from './member-fixture';
import { selectDemoActor } from '../src/domain/session';
import { reimbursementService } from '../src/services/reimbursements';
import { memberService } from '../src/services/member';
import { directorService } from '../src/services/director';
const { raw } = setupMember();
it('retains authorized resolution history without changing money, evidence or Member receipt acknowledgment', async () => {
  selectDemoActor('treasurer-nora');
  await reimbursementService.record('exp-2', {
    amount: 420000,
    date: '2026-11-05',
    reference: 'DEMO-ISSUE',
    confirmed: true,
    proof,
  });
  const payment = raw().payments.find((p) => p.expenseId === 'exp-2')!;
  selectDemoActor('member-ava');
  await memberService.discrepancy(payment.id, 'Amount not received', 0);
  await expect(
    reimbursementService.resolveIssue(payment.id, 'Checked transfer reference'),
  ).rejects.toThrow('role');
  selectDemoActor('treasurer-nora');
  await expect(reimbursementService.resolveIssue(payment.id, '')).rejects.toThrow('Describe');
  await reimbursementService.resolveIssue(
    payment.id,
    'Checked demo reference; please verify your account.',
  );
  await expect(
    reimbursementService.resolveIssue(
      payment.id,
      'Checked demo reference; please verify your account.',
    ),
  ).rejects.toThrow('already');
  const updated = raw().payments.find((p) => p.id === payment.id)!;
  expect(updated.manual!.receivedConfirmedAt).toBeUndefined();
  expect(updated.manual!.discrepancy).toMatchObject({
    reason: 'Amount not received',
    resolutions: [
      { note: 'Checked demo reference; please verify your account.', by: 'treasurer-nora' },
    ],
  });
  expect(updated.amount).toBe(payment.amount);
  expect(updated.manual!.proof).toEqual(payment.manual!.proof);
  selectDemoActor('director-jamie');
  expect(JSON.stringify(await directorService.load())).not.toContain('Checked demo reference');
  selectDemoActor('member-ava');
  await memberService.confirm(payment.id, 420000, true);
  selectDemoActor('treasurer-nora');
  await expect(reimbursementService.resolveIssue(payment.id, 'Late overwrite')).rejects.toThrow(
    'open',
  );
  expect(
    raw().payments.find((p) => p.id === payment.id)!.manual!.discrepancy!.resolutions,
  ).toHaveLength(1);
});
