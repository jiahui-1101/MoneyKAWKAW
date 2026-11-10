"""Validation-only selection; test outcomes are never used for model selection."""
import hashlib
import argparse
import json
import platform
import time
from datetime import datetime, timezone
import joblib
import lightgbm as lgb
import numpy as np
import psutil
from sklearn.metrics import log_loss
from baselines import fit_baselines, heuristic, metrics
from schema import NAMES
from simulate import ROOT
from validate import validate


def load():
    data = json.loads((ROOT / 'dataset.json').read_text())
    validate(data)
    return data, {s: (np.array([r['features'] for r in data['rows'] if r['split'] == s]),
                      np.array([r['label'] for r in data['rows'] if r['split'] == s]))
                  for s in ('train', 'validation', 'test', 'challenge')}


def train(seed=2026, threads=4, rounds=400, leaves_options=(7, 15)):
    if not 1 <= threads <= 16 or not 2 <= rounds <= 1000 or any(n not in range(2, 16) for n in leaves_options):
        raise ValueError('Use small CPU trees, 1–16 threads and 2–1000 rounds')
    started = time.perf_counter()
    data, splits = load()
    x, y = splits['train']
    vx, vy = splits['validation']
    logistic, prior = fit_baselines(x, y)
    joblib.dump(logistic, ROOT / 'logistic.joblib')
    baseline = {s: {'majority': metrics(sy, np.full(len(sy), prior)),
                    'logistic': metrics(sy, logistic.predict_proba(sx)[:, 1]),
                    'heuristic': metrics(sy, heuristic(sx))}
                for s, (sx, sy) in splits.items()}
    (ROOT / 'baselines.json').write_text(json.dumps(baseline, indent=2))
    candidates = []
    models = []
    for leaves in leaves_options:
        params = dict(objective='binary', metric='binary_logloss', learning_rate=.04,
                      num_leaves=leaves, max_depth=4, min_data_in_leaf=50,
                      lambda_l2=2, verbosity=-1, seed=seed, num_threads=threads,
                      deterministic=True, force_col_wise=True)
        history = {}
        model = lgb.train(params, lgb.Dataset(x, label=y, feature_name=NAMES),
                          num_boost_round=rounds, valid_sets=[lgb.Dataset(vx, label=vy)],
                          callbacks=[lgb.early_stopping(35, verbose=False), lgb.record_evaluation(history)])
        loss = log_loss(vy, model.predict(vx))
        candidates.append(dict(params=params, best_iteration=model.best_iteration,
                               validation_logloss=loss, history=history))
        models.append(model)
    selected = int(np.argmin([c['validation_logloss'] for c in candidates]))
    model = models[selected]
    model.save_model(str(ROOT / 'model.txt'))
    # A second fit checks CPU reproducibility on the selected validation protocol.
    repeat = lgb.train(candidates[selected]['params'], lgb.Dataset(x, label=y, feature_name=NAMES),
                       num_boost_round=model.best_iteration)
    delta = float(np.max(np.abs(model.predict(vx) - repeat.predict(vx))))
    assert delta < 1e-12
    report = dict(trained_at=datetime.now(timezone.utc).isoformat(), selected=selected,
                  candidates=candidates, seconds=time.perf_counter() - started,
                  examples=len(y), positives=int(y.sum()), negatives=int((y == 0).sum()),
                  dataset_sha256=hashlib.sha256((ROOT / 'dataset.json').read_bytes()).hexdigest(),
                  model_sha256=hashlib.sha256((ROOT / 'model.txt').read_bytes()).hexdigest(),
                  reproducibility_max_delta=delta, prior=prior,
                  hardware=dict(platform=platform.platform(), cpu=platform.processor(),
                                logical_cpus=psutil.cpu_count(), rss_bytes=psutil.Process().memory_info().rss,
                                memory_bytes=psutil.virtual_memory().total),
                  train_metrics=metrics(y, model.predict(x)), validation_metrics=metrics(vy, model.predict(vx)),
                  importance=dict(zip(NAMES, model.feature_importance('gain').tolist())))
    (ROOT / 'training.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ('examples', 'positives', 'seconds', 'selected', 'model_sha256')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=2026)
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--rounds', type=int, default=400)
    parser.add_argument('--leaves', type=int, nargs='+', default=[7, 15])
    args = parser.parse_args()
    train(args.seed, args.threads, args.rounds, args.leaves)
