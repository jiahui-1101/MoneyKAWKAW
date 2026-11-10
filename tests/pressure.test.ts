import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressureFeatures, pressureSchema, validatePressureSnapshot } from '../src/domain/pressure-features';
import { predictPressure, validatePressureModel, type PressureModel } from '../src/domain/pressure-trees';
import { runPressureModel } from '../src/services/pressure-model';
const raw = { activity_budget_sen: 1000000, allocation_sen: 200000, available_sen: 189000,
  activity_available_sen: 989000, claim_sen: 11000, estimate_sen: 8000, unclaimed_sen: 0,
  pending_sen: 11000, liability_sen: 0, paid_sen: 0, unclaimed_count: 0, pending_count: 1,
  days_elapsed: 9, days_remaining: 51 };
const model: PressureModel = { schema: pressureSchema.version, format: 'lightgbm-numeric-trees-v1',
  features: pressureSchema.features.map((f) => f.name), trees: [{ value: 0, count: 2,
    feature: 2, threshold: .5, defaultLeft: true,
    left: { value: 1, count: 1 }, right: { value: -1, count: 1 } }] };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('experimental pressure boundary', () => {
  it('uses integer sen sources and exact shared feature order', () => {
    const values = pressureFeatures(raw);
    expect(values).toEqual([2000, .2, .945, .989, .055, .04, 0, .055, 0, 0, 0, 1, 9, 51]);
    expect(() => pressureFeatures({ ...raw, bank: 123 })).toThrow();
    expect(() => pressureFeatures({ ...raw, paid_sen: -1 })).toThrow();
    expect(() => pressureFeatures({ ...raw, available_sen: 197000 })).toThrow();
    expect(() => pressureFeatures({ ...raw, claim_sen: NaN })).toThrow();
  });
  it('rejects stale claim/revision context and invalid horizons', () => {
    const snapshot = { schema: pressureSchema.version, claimId: 'a', revision: 1, updatedAt: 'r1',
      asOf: '2026-11-10T00:00:00Z', horizonEnd: '2026-12-01T00:00:00Z', raw };
    expect(validatePressureSnapshot(snapshot, 'a', 'r1')).toHaveLength(14);
    expect(() => validatePressureSnapshot(snapshot, 'b', 'r1')).toThrow();
    expect(() => validatePressureSnapshot(snapshot, 'a', 'r2')).toThrow();
    expect(() => validatePressureSnapshot({ ...snapshot, horizonEnd: snapshot.asOf }, 'a', 'r1')).toThrow();
  });
  it('executes numeric trees and additive path contributions, including missing values', () => {
    const validated = validatePressureModel(model), values = pressureFeatures(raw);
    const result = predictPressure(validated, values);
    expect(result.score).toBeCloseTo(1 / (1 + Math.exp(1)));
    expect(result.base + result.contributions.reduce((a, b) => a + b, 0)).toBe(result.raw);
    values[2] = .5;
    expect(predictPressure(validated, values).raw).toBe(1);
    expect(predictPressure(validated, values.map(() => null)).raw).toBe(1);
    expect(() => validatePressureModel({ ...model, features: [] })).toThrow();
    expect(() => predictPressure(validated, [NaN])).toThrow();
  });
  it('cancels a worker and ignores replies from other requests', async () => {
    let worker!: { onmessage: (e: { data: unknown }) => void; terminate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> };
    vi.stubGlobal('Worker', class {
      terminate = vi.fn(); postMessage = vi.fn(); onmessage = () => {};
      constructor() { worker = this; }
    });
    const control = new AbortController();
    const result = runPressureModel(pressureFeatures(raw), control.signal);
    worker.onmessage({ data: { id: 'another-claim', score: 0 } });
    control.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('times out and terminates without generating a model score', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage() {} });
    const result = runPressureModel(pressureFeatures(raw), new AbortController().signal);
    const assertion = expect(result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
    expect(terminate).toHaveBeenCalledOnce();
  });
  it('provides an explicit disabled fallback', async () => {
    vi.stubEnv('VITE_PRESSURE_MODEL', 'off');
    await expect(runPressureModel(pressureFeatures(raw), new AbortController().signal)).rejects.toThrow('disabled');
  });
});
