import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('rejects incompatible manifests and corrupt actual artifact bytes', async () => {
  vi.stubGlobal('self', { onmessage: undefined });
  const { loadPressureModel } = await import('../src/services/pressure-model.worker');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ featureSchema: 'future-schema' }) }));
  await expect(loadPressureModel()).rejects.toThrow('manifest');
  const hash = '0'.repeat(64);
  const manifest = { featureSchema: 'budget-pressure-v1', dataset: 'SYNTHETIC', experimental: true,
    realWorldValidation: false, horizonDays: 30, sha256: hash, file: `${hash}.json`,
    version: `pressure-v1:${hash.slice(0, 12)}`, iterations: 10 };
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => manifest })
    .mockResolvedValueOnce({ ok: true, headers: new Headers(), arrayBuffer: async () => new TextEncoder().encode('corrupt-model').buffer }));
  await expect(loadPressureModel()).rejects.toThrow('checksum');
});
