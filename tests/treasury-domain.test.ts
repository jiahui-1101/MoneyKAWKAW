import { describe, expect, it } from 'vitest';
import { summarize } from '../src/domain/budget';
import { departmentBudget } from '../src/domain/hod';
import { analyzeClaim, receiptLines, validateRiskRules } from '../src/domain/risk';
import { seed } from '../src/services/seed';
import { upgradeTreasury } from '../src/services/treasury-migration';
import { projectHod } from '../src/services/hod-access';
import { selectDemoActor } from '../src/domain/session';
import { validateProof } from '../src/services/payment-proof';
import type { ProofFile } from '../src/domain/treasury';

export const demoProof: ProofFile = {
  name: 'sample-proof.png',
  mime: 'image/png',
  size: 68,
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tK0AAAAASUVORK5CYII=',
};
describe('shared claim financial rules', () => {
  it('releases only the variance on decline while keeping the original task estimate reserved', () => {
    const store = structuredClone(seed);
    const claim = store.expenses.find((e) => e.id === 'exp-5')!;
    store.assignments.find((t) => t.expenseId === claim.id)!.budget = 15000;
    claim.amount = 19000;
    const submitted = summarize(store, claim.activityId, claim.departmentId);
    claim.state = 'Declined';
    const declined = summarize(store, claim.activityId, claim.departmentId);
    expect(declined.available).toBe(submitted.available + 4000);
    expect(declined.recorded).toBe(0);
    expect(declined.committed).toBe(15000);
  });
  it('upgrades old records idempotently without changing financial amounts', () => {
    const old = structuredClone(seed);
    delete old.treasury;
    const upgraded = upgradeTreasury(old);
    expect(summarize(upgraded)).toEqual(summarize(old));
    expect(upgradeTreasury(upgraded)).toEqual(upgraded);
    expect(old.treasury).toBeUndefined();
    expect(summarize(upgraded)).toMatchObject({
      budget: 9800000,
      allocated: 9350000,
      recorded: 4565000,
      pending: 1105000,
      paid: 3040000,
      committed: 820000,
      available: 4835000,
    });
  });
  it('does not double count review, approval or payment; decline retains task reservation', () => {
    const store = structuredClone(seed);
    const claim = store.expenses.find((e) => e.id === 'exp-5')!;
    const before = summarize(store);
    claim.state = 'In review';
    expect(summarize(store)).toEqual(before);
    claim.state = 'Approved';
    const approved = summarize(store);
    expect(approved.recorded).toBe(before.recorded);
    expect(approved.available).toBe(before.available);
    expect(approved.pending).toBe(before.pending - claim.amount);
    store.payments.push({
      id: 'test-pay',
      expenseId: claim.id,
      amount: claim.amount,
      date: claim.date,
    });
    expect(summarize(store).available).toBe(before.available);
    expect(summarize(store).committed).toBe(before.committed);
    store.payments.pop();
    claim.state = 'Declined';
    const declined = summarize(store);
    expect(declined.recorded).toBe(before.recorded - claim.amount);
    expect(declined.available).toBe(before.available);
    selectDemoActor('hod-mei');
    expect(
      departmentBudget(projectHod(store), claim.activityId, claim.departmentId).available,
    ).toBe(summarize(store, claim.activityId, claim.departmentId).available);
    selectDemoActor('director-jamie');
  });
  it('reconstructs final claim lines without mutating original extraction or excluded lines', () => {
    const receipt = structuredClone(seed.treasury!.receipts[0]);
    const original = structuredClone(receipt);
    const lines = receiptLines(receipt);
    expect(lines.find((l) => l.original.id === 'personal')?.excluded).toBe(true);
    expect(lines.filter((l) => !l.excluded).reduce((s, l) => s + l.final.amount, 0)).toBe(
      seed.expenses[0].amount,
    );
    expect(receipt).toEqual(original);
  });
});
describe('transparent deterministic advisory analysis', () => {
  it('calculates RM150 → RM190 as RM40 / 26.67%, with configurable thresholds', () => {
    const store = structuredClone(seed);
    const claim = store.expenses.find((e) => e.id === 'exp-5')!;
    store.assignments.find((t) => t.expenseId === claim.id)!.budget = 15000;
    claim.amount = 19000;
    const result = analyzeClaim(store, claim, 'Test Treasurer');
    expect(result.variance).toBe(4000);
    expect(result.variancePercent).toBeCloseTo(26.6667, 3);
    expect(result.band).toBe('High');
    store.treasury!.rules.highVariance = 50;
    expect(analyzeClaim(store, claim, 'Test Treasurer').band).toBe('Medium');
    expect(result.rules.highVariance).toBe(25);
  });
  it('identifies negative department headroom even without item variance', () => {
    const store = structuredClone(seed);
    const claim = store.expenses.find((e) => e.id === 'exp-7')!;
    const result = analyzeClaim(store, claim, 'Test');
    expect(result.variance).toBe(0);
    expect(result.departmentAvailable).toBe(-55000);
    expect(result.factors.find((f) => f.label === 'Department headroom')?.level).toBe('High');
    expect(result.band).toBe('High');
  });
  it('rejects invalid or non-increasing thresholds', () => {
    expect(() =>
      validateRiskRules({ mediumVariance: 25, highVariance: 10, lowHeadroomPercent: 20 }),
    ).toThrow();
    expect(() =>
      validateRiskRules({ mediumVariance: NaN, highVariance: 25, lowHeadroomPercent: 20 }),
    ).toThrow();
  });
});
describe('payment proof validation', () => {
  it('validates content signature, MIME type, size, encoding and supported limits', () => {
    expect(() => validateProof(demoProof)).not.toThrow();
    for (const bad of [
      { ...demoProof, size: 2_000_000 },
      { ...demoProof, mime: 'text/html' },
      { ...demoProof, size: 4, dataUrl: 'data:image/png;base64,dGVzdA==' },
      { ...demoProof, size: 100 },
      { ...demoProof, dataUrl: 'javascript:alert(1)' },
    ])
      expect(() => validateProof(bad as ProofFile)).toThrow();
  });
});
