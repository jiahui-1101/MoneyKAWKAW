import assert from 'node:assert/strict';
import test from 'node:test';
import { admin } from './helpers.mjs';

test('database rejects allocation overflow and relabeling existing club budgets', async () => {
  const belowAllocations = await admin.from('activities').update({ budget_sen: 599999 })
    .eq('id', '22222222-2222-4222-8222-222222222221');
  assert.equal(belowAllocations.error?.code, '23514');
  const overAllocation = await admin.from('departments').insert({
    club_id: '11111111-1111-4111-8111-111111111111',
    activity_id: '22222222-2222-4222-8222-222222222221', name: 'Overrun', allocation_sen: 1,
  });
  assert.equal(overAllocation.error?.code, '23514');
  const mismatchedCurrency = await admin.from('activities').update({ currency: 'SGD' })
    .eq('id', '22222222-2222-4222-8222-222222222221');
  assert.equal(mismatchedCurrency.error?.code, '23514');
  const relabelClub = await admin.from('clubs').update({ currency: 'SGD' })
    .eq('id', '11111111-1111-4111-8111-111111111111');
  assert.equal(relabelClub.error?.code, '23514');
});
