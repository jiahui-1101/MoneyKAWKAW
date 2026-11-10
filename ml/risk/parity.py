"""Native reference predictions for shared JS runtime and feature parity."""
import json
import lightgbm as lgb
import numpy as np
from simulate import ROOT
from train import load


def reference():
    data, splits = load()
    model = lgb.Booster(model_file=str(ROOT / 'model.txt'))
    rng = np.random.default_rng(6006)
    x = splits['train'][0]
    random = rng.uniform(x.min(axis=0), x.max(axis=0), size=(10000, x.shape[1]))
    boundaries = []
    def visit(n):
        if 'split_feature' in n:
            for delta in (-1e-10, 0, 1e-10):
                row = np.median(x, axis=0)
                row[n['split_feature']] = n['threshold'] + delta
                boundaries.append(row)
            visit(n['left_child']); visit(n['right_child'])
    for tree in model.dump_model()['tree_info']:
        visit(tree['tree_structure'])
    missing = x[:100].copy()
    for i in range(len(missing)):
        missing[i, i % x.shape[1]] = np.nan
    rows = np.concatenate([random, boundaries, missing, splits['test'][0], splits['challenge'][0]])
    scores = model.predict(rows)
    encoded = [[None if np.isnan(v) else float(v) for v in row] for row in rows]
    payload = dict(rows=encoded, scores=scores.tolist(),
                   feature_cases=[{'raw': r['raw'], 'features': r['features']} for r in data['rows']],
                   counts=dict(random=len(random), boundary=len(boundaries), missing=len(missing)))
    (ROOT / 'parity-input.json').write_text(json.dumps(payload))


if __name__ == '__main__':
    reference()
