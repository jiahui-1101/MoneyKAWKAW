import { pressureSchema } from './pressure-features';
export interface PressureNode {
  value: number;
  count: number;
  feature?: number;
  threshold?: number;
  defaultLeft?: boolean;
  left?: PressureNode;
  right?: PressureNode;
}
export interface PressureModel {
  schema: string;
  format: string;
  features: string[];
  trees: PressureNode[];
}
export function validatePressureModel(model: PressureModel) {
  if (model.schema !== pressureSchema.version || model.format !== 'lightgbm-numeric-trees-v1' ||
      JSON.stringify(model.features) !== JSON.stringify(pressureSchema.features.map((f) => f.name)) ||
      !Array.isArray(model.trees) || !model.trees.length || model.trees.length > 400)
    throw new Error('Incompatible LightGBM artifact.');
  let nodes = 0;
  const check = (n: PressureNode, depth: number) => {
    if (!n || !Number.isFinite(n.value) || !Number.isSafeInteger(n.count) || n.count < 1 ||
        depth > 8 || ++nodes > 20000) throw new Error('Invalid LightGBM tree.');
    if (n.feature !== undefined) {
      if (!Number.isInteger(n.feature) || n.feature < 0 || n.feature >= model.features.length ||
          !Number.isFinite(n.threshold) || typeof n.defaultLeft !== 'boolean')
        throw new Error('Invalid LightGBM split.');
      check(n.left!, depth + 1); check(n.right!, depth + 1);
    } else if (n.left || n.right) throw new Error('Invalid LightGBM leaf.');
  };
  model.trees.forEach((n) => check(n, 0));
  return model;
}
export function predictPressure(model: PressureModel, values: (number | null)[]) {
  if (values.length !== model.features.length || values.some((n) => n !== null && !Number.isFinite(n)))
    throw new Error('Invalid LightGBM inputs.');
  let raw = 0, base = 0;
  const contributions = Array<number>(values.length).fill(0);
  for (const tree of model.trees) {
    let n = tree;
    base += n.value;
    while (n.feature !== undefined) {
      const feature = n.feature, value = values[feature];
      const next = (value === null ? n.defaultLeft : value <= n.threshold!) ? n.left! : n.right!;
      contributions[feature] += next.value - n.value;
      n = next;
    }
    raw += n.value;
  }
  const score = 1 / (1 + Math.exp(-raw));
  if (!Number.isFinite(score) || Math.abs(base + contributions.reduce((s, n) => s + n, 0) - raw) > 1e-8)
    throw new Error('Invalid LightGBM output.');
  return { score, raw, base, contributions };
}
