import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { directorService, STORAGE_KEY } from '../src/services/director';
import { seed } from '../src/services/seed';

describe('browser-local persistence adapter', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('loads isolated sample records and persists valid records across reloads', async () => {
    const loaded = await directorService.load();
    loaded.activities[0].name = 'Changed locally';
    expect(seed.activities[0].name).toBe('Innovation Summit 2026');
    await directorService.save(loaded);
    expect((await directorService.load()).activities[0].name).toBe('Changed locally');
  });
  it('surfaces corrupted data without overwriting it and supports explicit recovery', async () => {
    values.set(STORAGE_KEY, '{bad json');
    await expect(directorService.load()).rejects.toThrow('could not be read');
    expect(values.get(STORAGE_KEY)).toBe('{bad json');
    expect((await directorService.reset()).activities).toEqual(seed.activities);
    expect(values.has(STORAGE_KEY)).toBe(false);
  });
  it('rejects invalid records before writing', async () => {
    const bad = structuredClone(seed);
    bad.activities[0].budget = -1;
    await expect(directorService.save(bad)).rejects.toThrow();
    expect(values.size).toBe(0);
  });
  it('surfaces storage failures instead of pretending to save', async () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    await expect(directorService.save(seed)).rejects.toThrow('could not be saved');
  });
});
