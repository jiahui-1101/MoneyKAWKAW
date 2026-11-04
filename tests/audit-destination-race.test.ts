import { expect, it } from 'vitest';
import { setupMember, account, proof } from './member-fixture';
import { selectDemoActor } from '../src/domain/session';
import { accountService } from '../src/services/member-accounts';
import { memberClaimService } from '../src/services/member-claims';
import { reimbursementService } from '../src/services/reimbursements';
const { raw } = setupMember();
it('blocks recording against instructions superseded while the Treasurer form was open', async () => {
  selectDemoActor('treasurer-nora');
  const old = await reimbursementService.destination('exp-2');
  const oldRevision = old.revision;
  selectDemoActor('member-ava');
  const accountId = (await accountService.save(account)).result;
  await memberClaimService.changeDestination(
    'exp-2',
    accountId,
    'Explicit new destination while unpaid.',
  );
  selectDemoActor('treasurer-nora');
  const input = {
    amount: 420000,
    date: '2026-11-05',
    reference: 'DEMO-STALE-DESTINATION',
    confirmed: true,
    proof,
    destinationRevision: oldRevision,
  };
  let failure = '';
  try {
    await reimbursementService.record('exp-2', input);
  } catch (e) {
    failure = (e as Error).message;
  }
  expect(failure).toContain('destination changed');
  expect(raw().payments.some((p) => p.expenseId === 'exp-2')).toBe(false);
  const current = await reimbursementService.destination('exp-2');
  await reimbursementService.record('exp-2', { ...input, destinationRevision: current.revision });
  expect(raw().payments.find((p) => p.expenseId === 'exp-2')!.manual).toMatchObject({
    destinationRevision: current.revision,
    payout: { masked: 'Bank •••• 3333' },
  });
});
