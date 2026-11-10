"""Predeclared diagnostic subsets; never used for selecting/retraining models."""
import json
import joblib
import lightgbm as lgb
import numpy as np
from baselines import heuristic, metrics
from schema import NAMES
from simulate import ROOT
from train import load

data, _ = load()
rows = [r for r in data['rows'] if r['split'] in ('test', 'challenge')]
negative = [r for r in rows if not r['label']]
positive = [r for r in rows if r['label']]
subsets = dict(
    rare_pressure_10pct=negative + positive[:max(1, len(negative) // 9)],
    unobserved_large_demand=[r for r in rows if any(e['kind'] == 'demand' and
                            e['amount_sen'] > r['raw']['allocation_sen'] * .15 for e in r['future_events'])],
    late_demand_family=[r for r in rows if r['family'] % 3 == 0],
    no_prior_recorded_claims=[r for r in rows if r['raw']['paid_sen'] == 0 and
                            r['raw']['liability_sen'] == 0 and r['raw']['pending_count'] == 1])
model = lgb.Booster(model_file=str(ROOT / 'model.txt'))
logistic = joblib.load(ROOT / 'logistic.joblib')
prior = json.loads((ROOT / 'training.json').read_text())['prior']
result = {}
for name, selected in subsets.items():
    if not selected:
        result[name] = {'count': 0, 'status': 'Not evaluated: no matching examples'}
        continue
    x = np.array([r['features'] for r in selected])
    y = np.array([r['label'] for r in selected])
    result[name] = dict(count=len(y), positives=int(y.sum()), majority=metrics(y, np.full(len(y), prior)),
                        logistic=metrics(y, logistic.predict_proba(x)[:, 1]),
                        heuristic=metrics(y, heuristic(x)), lightgbm=metrics(y, model.predict(x)))
# Model-level missing branches are measured independently of strict app validation.
x = np.full((1, len(NAMES)), np.nan)
score = float(model.predict(x)[0])
assert np.isfinite(score)
result['all_required_features_missing'] = dict(native_score=score,
    deployment='Rejected by application feature schema; financial rules remain available')
(ROOT / 'stress.json').write_text(json.dumps(result, indent=2))
print(json.dumps({k: {'count': v.get('count'), 'positives': v.get('positives')} for k, v in result.items()}))
