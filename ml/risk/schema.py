"""One declarative feature contract for simulation, training and browser."""
import json
import math
from pathlib import Path

SCHEMA = json.loads(Path(__file__).with_name('feature-schema.json').read_text())
NAMES = [f['name'] for f in SCHEMA['features']]
KEYS = {f['source'] for f in SCHEMA['features']} | {'activity_budget_sen'}
SIGNED = {'available_sen', 'activity_available_sen'}


def vector(raw):
    if set(raw) != KEYS:
        raise ValueError('Unknown or missing feature source')
    for key, value in raw.items():
        if isinstance(value, bool) or not isinstance(value, int) or abs(value) > 2**53 - 1:
            raise ValueError('Feature sources must be safe integers')
        if value < 0 and key not in SIGNED:
            raise ValueError('Negative monetary/count/time source')
    if raw['allocation_sen'] <= 0 or raw['activity_budget_sen'] < raw['allocation_sen']:
        raise ValueError('Invalid budget scale')
    if raw['available_sen'] != raw['allocation_sen'] - sum(raw[k] for k in (
            'unclaimed_sen', 'pending_sen', 'liability_sen', 'paid_sen')):
        raise ValueError('Canonical exposure does not reconcile')
    result = [raw[f['source']] / (raw[f['denominator']] if 'denominator' in f
              else f.get('scale', 1)) for f in SCHEMA['features']]
    if not all(math.isfinite(x) for x in result):
        raise ValueError('Nonfinite feature')
    return result
