import { expect, it } from 'vitest';
import { setupMember, capturedDraft, account, proof } from './member-fixture';
import { accountService } from '../src/services/member-accounts';
import { draftService } from '../src/services/member-drafts';
import { memberClaimService } from '../src/services/member-claims';
import { selectDemoActor } from '../src/domain/session';
import { memberService } from '../src/services/member';
import { validateReceiptFile } from '../src/services/member-drafts';
const { raw } = setupMember();
it('rechecks all revisions, serializes duplicate submission, and audits an explicit unpaid destination change', async () => {
  const first = (await accountService.save(account)).result;
  const second = (
    await accountService.save({
      ...account,
      label: 'Other bank',
      identifier: '555566667777',
      isDefault: false,
    })
  ).result;
  let draft = await capturedDraft();
  await draftService.preferences(draft.id, draft.updatedAt, first, '');
  draft = await draftService.load(draft.id);
  const context = await memberClaimService.context(draft.id);
  await expect(
    memberClaimService.submit(draft.id, 'stale', context.taskUpdatedAt, context.accountUpdatedAt),
  ).rejects.toThrow('changed');
  await expect(
    memberClaimService.submit(draft.id, draft.updatedAt, 'stale', context.accountUpdatedAt),
  ).rejects.toThrow('changed');
  await expect(
    memberClaimService.submit(draft.id, draft.updatedAt, context.taskUpdatedAt, 'stale'),
  ).rejects.toThrow('changed');
  const results = await Promise.allSettled([
    memberClaimService.submit(
      draft.id,
      draft.updatedAt,
      context.taskUpdatedAt,
      context.accountUpdatedAt,
    ),
    memberClaimService.submit(
      draft.id,
      draft.updatedAt,
      context.taskUpdatedAt,
      context.accountUpdatedAt,
    ),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const claim = raw().expenses.find((e) => e.id.startsWith('claim-'))!;
  await accountService.setDefault(second);
  expect((await memberClaimService.destination(claim.id)).accountId).toBe(first);
  await expect(memberClaimService.changeDestination(claim.id, second, '')).rejects.toThrow(
    'Explain',
  );
  await memberClaimService.changeDestination(
    claim.id,
    second,
    'Use my other saved account for this unpaid request.',
  );
  const payout = raw().treasury!.payouts.find((p) => p.expenseId === claim.id)!;
  expect(payout).toMatchObject({
    accountId: second,
    identifier: '555566667777',
    history: [{ accountId: first, masked: 'Bank •••• 3333', actor: 'member-ava' }],
  });
  expect(await memberClaimService.destination(claim.id)).not.toHaveProperty('identifier');
  expect(await memberClaimService.destination(claim.id)).not.toHaveProperty('history');
  selectDemoActor('member-ryan');
  await expect(
    memberClaimService.changeDestination(claim.id, second, 'Foreign redirect'),
  ).rejects.toThrow('unavailable');
  await expect(memberService.proof(raw().payments[0].id)).rejects.toThrow();
});
it('rejects spoofed, oversized and unsupported receipt evidence before persistence', () => {
  expect(() =>
    validateReceiptFile({
      ...proof,
      mime: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=',
      size: 14,
    }),
  ).toThrow('PNG or JPEG');
  expect(() => validateReceiptFile({ ...proof, size: 100 })).toThrow();
  expect(() => validateReceiptFile({ ...proof, size: 1024 * 1024 + 1 })).toThrow();
  expect(() =>
    validateReceiptFile({ ...proof, dataUrl: 'https://example.com/not-an-upload.png' }),
  ).toThrow();
});
