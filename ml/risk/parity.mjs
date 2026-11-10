import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
await build({ entryPoints: ['src/domain/pressure-trees.ts', 'src/domain/pressure-features.ts'],
  outdir: '.local/phase06/parity-runtime', bundle: true, platform: 'node', format: 'esm' });
const { validatePressureModel, predictPressure } = await import(pathToFileURL(`${process.cwd()}/.local/phase06/parity-runtime/pressure-trees.js`));
const { pressureFeatures } = await import(pathToFileURL(`${process.cwd()}/.local/phase06/parity-runtime/pressure-features.js`));
const root = 'public/models/budget-pressure/';
const manifest = JSON.parse(readFileSync(`${root}manifest.json`));
const model = validatePressureModel(JSON.parse(readFileSync(root + manifest.file)));
const input = JSON.parse(readFileSync('.local/phase06/parity-input.json'));
let maxDelta = 0, disagreement = 0;
const start = performance.now();
input.rows.forEach((row, i) => {
  const score = predictPressure(model, row).score;
  maxDelta = Math.max(maxDelta, Math.abs(score - input.scores[i]));
  disagreement += (score >= .5) !== (input.scores[i] >= .5) ? 1 : 0;
});
for (const c of input.feature_cases) {
  if (JSON.stringify(pressureFeatures(c.raw)) !== JSON.stringify(c.features)) throw new Error('Feature parity failed');
}
if (maxDelta > 1e-10 || disagreement) throw new Error('Trained model parity failed');
const result = { examples: input.rows.length, ...input.counts, featureCases: input.feature_cases.length,
  maxDelta, disagreement, milliseconds: performance.now() - start, model: manifest.version };
writeFileSync('.local/phase06/parity.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
