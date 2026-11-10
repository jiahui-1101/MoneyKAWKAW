"""Held-out and OOD results; do not feed these results back into selection."""
import json
import time
import lightgbm as lgb
import numpy as np
from baselines import metrics
from simulate import ROOT
from train import load


def evaluate():
    data, splits = load()
    model = lgb.Booster(model_file=str(ROOT / 'model.txt'))
    baselines = json.loads((ROOT / 'baselines.json').read_text())
    result = {}
    for split, (x, y) in splits.items():
        score = model.predict(x)
        result[split] = dict(baselines[split], lightgbm=metrics(y, score))
    # Conditions chosen in advance; no new threshold tuning on these subsets.
    held = [r for r in data['rows'] if r['split'] in ('test', 'challenge')]
    subsets = dict(small_budget=lambda r: r['raw']['allocation_sen'] < 50000,
                   large_budget=lambda r: r['raw']['allocation_sen'] > 5000000,
                   near_zero=lambda r: r['features'][2] < .05,
                   approaching_end=lambda r: r['raw']['days_remaining'] <= 7,
                   high_pending=lambda r: r['features'][7] > .3,
                   no_paid_claims=lambda r: r['raw']['paid_sen'] == 0)
    result['stress'] = {}
    for name, condition in subsets.items():
        rows = [r for r in held if condition(r)]
        if rows:
            x = np.array([r['features'] for r in rows])
            result['stress'][name] = dict(count=len(rows), lightgbm=metrics(
                np.array([r['label'] for r in rows]), model.predict(x)))
    x = splits['test'][0]
    timings = []
    for _ in range(100):
        start = time.perf_counter()
        model.predict(x[:1], num_threads=1)
        timings.append((time.perf_counter() - start) * 1000)
    result['benchmark_ms'] = dict(median=float(np.median(timings)), p95=float(np.percentile(timings, 95)))
    result['classification'] = 'Verified on SYNTHETIC held-out data; real-world validity not evaluated'
    (ROOT / 'evaluation.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({s: {m: round(v['f1'], 4) for m, v in result[s].items()}
                      for s in ('test', 'challenge')}))


if __name__ == '__main__':
    evaluate()
