"""SYNTHETIC lifecycles. Future events are stored apart from feature sources."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from ledger import Task, advance, balances, demand
from schema import SCHEMA, vector

VERSION = 'sen-lifecycle-v1'
ROOT = Path('.local/phase06')


def simulate(seed, family, split):
    rng = np.random.default_rng(seed)
    challenge = split == 'challenge'
    duration = int(rng.integers(15, 181 if not challenge else 366))
    allocation = int(10 ** rng.uniform(4, 7 if not challenge else 8))
    activity_budget = allocation * int(rng.integers(2, 9))
    snapshot = int(rng.integers(2, duration))
    # Family parameters are never exposed as features. Held-out families are disjoint.
    pace = .25 + (family % 9) * .055
    variance = .12 + (family % 5) * .07
    late = family % 3 == 0
    tasks = []
    events = []

    def step(day, future=False):
        rate = pace * (1.8 if late and day > duration * .65 else .8)
        if challenge:
            rate *= .35 if family % 2 else 1.6
        for _ in range(int(rng.poisson(rate))):
            amount = max(1, round(allocation * rng.lognormal(-3.6, .85)))
            if future and rng.random() < (.12 if challenge else .035):
                amount *= int(rng.integers(3, 9))  # genuinely unobserved shock
            accepted = demand(tasks, allocation, amount)
            events.append({'day': day, 'kind': 'demand', 'blocked': not accepted,
                           'amount_sen': amount})
        for task in list(tasks):
            if rng.random() < (.16 if challenge else .3):
                blocked = advance(task, tasks, allocation, rng, variance)
                events.append({'day': day, 'kind': 'review', 'blocked': blocked,
                               'amount_sen': task.amount})

    for day in range(snapshot):
        step(day)
    # Capture a realistic submitted claim, even if it makes current headroom negative.
    estimate = max(1, round(allocation * rng.uniform(.005, .12)))
    if not demand(tasks, allocation, estimate):
        # Use an existing purchase rather than inventing an illegal task reservation.
        candidates = [t for t in tasks if t.status in ('unclaimed', 'rejected', 'pending')]
        if not candidates:
            return None
        current = candidates[int(rng.integers(len(candidates)))]
    else:
        current = tasks[-1]
    if current.status != 'pending':
        advance(current, tasks, allocation, rng, variance)
    raw = dict(balances(tasks, allocation), allocation_sen=allocation,
               activity_budget_sen=activity_budget, claim_sen=current.amount,
               estimate_sen=current.estimate, days_elapsed=snapshot,
               days_remaining=duration - snapshot)
    other_exposure = round((activity_budget - allocation) * rng.uniform(.05, .95))
    raw['activity_available_sen'] = activity_budget - (allocation - raw['available_sen']) - other_exposure
    features = vector(raw)
    observed = [dict(e) for e in events]
    horizon = min(snapshot + SCHEMA['horizonDays'], duration)
    for day in range(snapshot + 1, duration + 1):
        step(day, True)
    future = [e for e in events if snapshot < e['day'] <= horizon]
    trajectory = hashlib.sha256(json.dumps(events, sort_keys=True).encode()).hexdigest()
    return dict(activity=f'SYNTHETIC-{seed}', family=family, split=split, seed=seed,
                prediction_day=snapshot, horizon_day=horizon, feature_day=snapshot,
                raw=raw, features=features, observed_events=observed, future_events=future,
                label=int(any(e['blocked'] for e in future)), trajectory=trajectory)


def generate(seed=20261110, per_family=100):
    rows = []
    for family in range(48):
        split = 'train' if family < 30 else 'validation' if family < 36 else 'test' if family < 42 else 'challenge'
        for i in range(per_family):
            row = simulate(seed + family * 10000 + i, family, split)
            if row:
                rows.append(row)
    return dict(provenance='SYNTHETIC', version=VERSION, seed=seed,
                config={'per_family': per_family, 'families': 48},
                schema=SCHEMA['version'], rows=rows)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=20261110)
    parser.add_argument('--per-family', type=int, default=100)
    args = parser.parse_args()
    ROOT.mkdir(parents=True, exist_ok=True)
    data = generate(args.seed, args.per_family)
    path = ROOT / 'dataset.json'
    path.write_text(json.dumps(data, sort_keys=True), encoding='utf-8')
    print(json.dumps({'examples': len(data['rows']), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}))
