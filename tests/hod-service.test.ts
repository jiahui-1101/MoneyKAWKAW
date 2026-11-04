import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hodService } from '../src/services/hod';
import { directorService, STORAGE_KEY } from '../src/services/director';
import { seed } from '../src/services/seed';
import { selectDemoActor } from '../src/domain/session';
import { summarize } from '../src/domain/budget';
import type { Store } from '../src/domain/models';
import type { TaskInput } from '../src/domain/hod';

const input: TaskInput = {
  name: 'HDMI cable',
  description: 'Workshop projector cable',
  budget: 8000,
  assigneeId: 'member-ava',
  dueDate: '2026-11-15',
  priority: 'Medium',
};
let values: Map<string, string>;
beforeEach(() => {
  values = new Map([[STORAGE_KEY, JSON.stringify(seed)]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  selectDemoActor('hod-sarah');
});
afterEach(() => {
  selectDemoActor('director-jamie');
  vi.unstubAllGlobals();
});

describe('HOD service authorization and persistence', () => {
  it('scopes department reads at the service boundary, including payment links and directory', async () => {
    const data = await hodService.department('innovation-summit', 'summit-programme');
    expect(data.scopes).toHaveLength(1);
    expect(data.assignments.every((t) => t.departmentId === 'summit-programme')).toBe(true);
    expect(data.directory.memberships.every((m) => m.departmentId === 'summit-programme')).toBe(
      true,
    );
    await expect(hodService.department('innovation-summit', 'summit-logistics')).rejects.toThrow(
      'access',
    );
  });
  it('saves into the same store and preserves financial records and protected fields', async () => {
    const result = await hodService.save('innovation-summit', 'summit-programme', {
      ...input,
      state: 'Approved',
      paid: 8000,
    } as TaskInput);
    expect(result.taskId).toBeTruthy();
    expect((await hodService.load()).assignments.some((t) => t.id === result.taskId)).toBe(true);
    selectDemoActor('director-jamie');
    const shared = await directorService.load();
    expect(shared.expenses).toEqual(seed.expenses);
    expect(shared.payments).toEqual(seed.payments);
    expect(summarize(shared, 'innovation-summit', 'summit-programme').available).toBe(472000);
  });
  it('rechecks revoked memberships on every mutation, rather than trusting a previously loaded view', async () => {
    await hodService.load();
    const revoked = structuredClone(seed);
    revoked.directory!.memberships = revoked.directory!.memberships.map((m) =>
      m.role === 'HOD' && m.departmentId === 'summit-programme' ? { ...m, active: false } : m,
    );
    values.set(STORAGE_KEY, JSON.stringify(revoked));
    await expect(hodService.save('innovation-summit', 'summit-programme', input)).rejects.toThrow(
      'access',
    );
    expect(
      (await hodService.load()).scopes.some((s) => s.department.id === 'summit-programme'),
    ).toBe(false);
  });
  it('rejects inactive assignees and source records from another department', async () => {
    const changed = structuredClone(seed);
    changed.directory!.memberships.forEach((m) => {
      if (m.userId === 'member-ryan' && m.departmentId === 'summit-programme') m.active = false;
    });
    values.set(STORAGE_KEY, JSON.stringify(changed));
    await expect(
      hodService.save('innovation-summit', 'summit-programme', {
        ...input,
        assigneeId: 'member-ryan',
      }),
    ).rejects.toThrow('eligible');
    await expect(
      hodService.cancel('innovation-summit', 'summit-programme', 'as-1'),
    ).rejects.toThrow('not available');
  });
  it('does not return HOD data after the demo identity changes during an async read', async () => {
    const reading = hodService.load();
    selectDemoActor('director-jamie');
    await expect(reading).rejects.toThrow('session changed');
  });
  it('surfaces failed writes instead of returning a successful purchase', async () => {
    const before = values.get(STORAGE_KEY);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    });
    await expect(hodService.save('innovation-summit', 'summit-programme', input)).rejects.toThrow(
      'could not be saved',
    );
    expect(values.get(STORAGE_KEY)).toBe(before);
  });
  it('loads legacy Director-only data without resetting it or changing the financial totals', async () => {
    const legacy: Store = structuredClone(seed);
    delete legacy.directory;
    legacy.assignments = legacy.assignments.filter((t) => ['as-1', 'as-2', 'as-3'].includes(t.id));
    legacy.assignments.forEach((t) => delete t.purchasing);
    values.set(STORAGE_KEY, JSON.stringify(legacy));
    const data = await hodService.load();
    expect(data.scopes).toHaveLength(2);
    selectDemoActor('director-jamie');
    const upgraded = await directorService.load();
    expect(summarize(upgraded)).toEqual(summarize(legacy));
  });
  it('returns an empty, scoped workspace after all HOD grants are revoked', async () => {
    const empty = structuredClone(seed);
    empty.directory!.memberships.forEach((m) => {
      if (m.role === 'HOD' && m.userId === 'hod-sarah') m.active = false;
    });
    values.set(STORAGE_KEY, JSON.stringify(empty));
    const data = await hodService.load();
    expect(data.scopes).toEqual([]);
    expect(data.assignments).toEqual([]);
    expect(data.expenses).toEqual([]);
    expect(data.directory.users).toEqual([]);
  });
});
