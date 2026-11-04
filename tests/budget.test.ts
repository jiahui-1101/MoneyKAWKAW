import { describe, expect, it } from 'vitest';
import { parseMoney, summarize } from '../src/domain/budget';
import { seed } from '../src/services/seed';
import { removeDepartment, updateSettings, upsertActivity, upsertDepartment, validateStore } from '../src/services/director';

describe('derived financial balances', () => {
  it('reconciles pending, paid, approved unpaid, and open assignments without double counting', () => {
    const s = summarize(seed);
    expect(s).toMatchObject({ budget: 9_800_000, allocated: 9_350_000, recorded: 4_565_000, pending: 1_105_000, paid: 3_040_000, committed: 820_000, remaining: 5_235_000, available: 4_835_000 });
    expect(s.budget - s.available).toBe(s.paid + s.pending + s.committed);
  });
  it('scopes balances by activity and department and exposes actual overruns', () => {
    expect(summarize(seed, 'community-day', 'community-logistics')).toMatchObject({ budget: 600_000, recorded: 655_000, remaining: -55_000 });
    expect(summarize(seed, 'innovation-summit')).toMatchObject({ budget: 4_000_000, recorded: 1_685_000, committed: 720_000 });
  });
  it('handles an empty organization without NaN or Infinity', () => {
    const s = summarize({ ...seed, activities: [] });
    expect(s.utilization).toBe(0); expect(s.available).toBe(0); expect(s.recorded).toBe(0);
  });
});

describe('monetary and setup validation', () => {
  it('parses decimal money exactly and accepts zero allocations', () => {
    expect(parseMoney('10.29')).toBe(1029); expect(parseMoney('0')).toBe(0);
  });
  it.each(['-10', '1.001', 'NaN', 'Infinity', '1e6', '', '1000000001'])('rejects invalid money %s', value => {
    expect(() => parseMoney(value)).toThrow();
  });
  const input = { name: 'Test workshop', description: 'A useful event', type: 'Workshop' as const, status: 'Planning' as const, startDate: '2026-12-01', endDate: '2026-12-02', budget: 100_000 };
  it('creates an activity, adds a department, updates the budget, and preserves history', () => {
    const created = upsertActivity(seed, input);
    const id = created.activities[0].id;
    const configured = upsertDepartment(created, id, { name: 'Logistics', head: 'Demo Lead', description: 'Venue', allocation: 80_000 });
    expect(summarize(configured, id).allocated).toBe(80_000);
    const updated = upsertActivity(configured, { ...input, budget: 120_000 }, id);
    expect(updated.activities[0].departments).toHaveLength(1);
    expect(updated.events).toHaveLength(seed.events.length + 3);
    expect(updated.events[0].detail).toContain('Before:');
    expect(seed.activities.some(a => a.id === id)).toBe(false);
    validateStore(updated);
  });
  it('prevents allocation totals above the activity ceiling, including edits', () => {
    expect(() => upsertDepartment(seed, 'innovation-summit', { name: 'Extra', head: '', description: '', allocation: 300_000 })).toThrow('exceed');
    const d = seed.activities[0].departments[0];
    expect(() => upsertDepartment(seed, 'innovation-summit', { ...d, allocation: 2_000_000 }, d.id)).toThrow('exceed');
    expect(() => upsertActivity(seed, { ...input, budget: 1_000_000 }, 'innovation-summit')).toThrow('existing department allocations');
  });
  it('rejects invalid dates, duplicate departments, blank names, and invalid statuses', () => {
    expect(() => upsertActivity(seed, { ...input, endDate: '2026-11-01' })).toThrow('dates');
    expect(() => upsertActivity(seed, { ...input, startDate: '2026-02-30' })).toThrow('dates');
    expect(() => upsertActivity(seed, { ...input, name: ' ' })).toThrow('name');
    expect(() => upsertDepartment(seed, 'innovation-summit', { name: ' logistics ', description: '', head: '', allocation: 0 })).toThrow('already exists');
  });
  it('preserves expense-linked departments and removes unused departments with history', () => {
    expect(() => removeDepartment(seed, 'innovation-summit', 'summit-logistics')).toThrow('cannot be removed');
    const created = upsertDepartment(seed, 'innovation-summit', { name: 'Temporary', description: '', head: '', allocation: 0 });
    const d = created.activities[0].departments.at(-1)!;
    const removed = removeDepartment(created, 'innovation-summit', d.id);
    expect(removed.activities[0].departments.some(x => x.id === d.id)).toBe(false);
    expect(removed.events[0].action).toBe('Department removed');
  });
  it('allows truthful overspending indicators without rewriting historical expenses', () => {
    const d = seed.activities[0].departments[0];
    const changed = upsertDepartment(seed, 'innovation-summit', { ...d, allocation: 100_000 }, d.id);
    expect(summarize(changed, 'innovation-summit', d.id).remaining).toBe(-780_000);
    expect(changed.expenses).toEqual(seed.expenses);
  });
  it('validates stored data and guards currency changes and policy settings', () => {
    validateStore(seed);
    expect(() => validateStore({ ...seed, version: 2 })).toThrow();
    const bad = structuredClone(seed); bad.expenses[0].departmentId = 'unknown';
    expect(() => validateStore(bad)).toThrow('expense');
    expect(() => updateSettings(seed, { ...seed.settings, warningPercent: 101 })).toThrow();
    expect(() => updateSettings(seed, { ...seed.settings, timezone: 'Not/AZone' })).toThrow();
    expect(() => updateSettings(seed, { ...seed.settings, currency: 'USD' })).toThrow('migration');
  });
});
