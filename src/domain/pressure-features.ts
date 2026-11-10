import schema from '../../ml/risk/feature-schema.json';
export const pressureSchema = schema;
export type PressureRaw = Record<string, number>;
export interface PressureSnapshot {
  schema: string;
  claimId: string;
  revision: number;
  updatedAt: string;
  asOf: string;
  horizonEnd: string;
  raw: PressureRaw;
}
export function pressureFeatures(raw: PressureRaw): number[] {
  const keys = new Set([...schema.features.map((f) => f.source), 'activity_budget_sen']);
  if (!raw || Object.keys(raw).length !== keys.size || Object.keys(raw).some((k) => !keys.has(k)))
    throw new Error('Incompatible financial feature schema.');
  for (const [key, value] of Object.entries(raw)) {
    if (!Number.isSafeInteger(value) || (value < 0 && !['available_sen', 'activity_available_sen'].includes(key)))
      throw new Error('Invalid financial feature value.');
  }
  if (raw.allocation_sen <= 0 || raw.activity_budget_sen < raw.allocation_sen ||
      raw.available_sen !== raw.allocation_sen - raw.unclaimed_sen - raw.pending_sen - raw.liability_sen - raw.paid_sen)
    throw new Error('Financial features do not reconcile.');
  return schema.features.map((f) => raw[f.source] / (f.denominator ? raw[f.denominator] : (f.scale ?? 1)));
}
export function validatePressureSnapshot(value: PressureSnapshot, claimId: string, updatedAt: string) {
  if (value.schema !== schema.version || value.claimId !== claimId || value.updatedAt !== updatedAt ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Number.isFinite(Date.parse(value.asOf)) || !Number.isFinite(Date.parse(value.horizonEnd)) ||
      Date.parse(value.horizonEnd) <= Date.parse(value.asOf) ||
      Date.parse(value.horizonEnd) - Date.parse(value.asOf) > 30 * 86400000)
    throw new Error('Stale or incompatible claim snapshot. Refresh the claim.');
  return pressureFeatures(value.raw);
}
