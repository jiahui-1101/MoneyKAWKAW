"""Fail closed on schema, temporal, label or split leakage."""
import hashlib
import json
from collections import Counter
from simulate import ROOT, VERSION
from schema import SCHEMA, vector


def validate(data):
    assert data['provenance'] == 'SYNTHETIC' and data['version'] == VERSION
    assert data['schema'] == SCHEMA['version']
    activities, families, trajectories = {}, {}, set()
    for row in data['rows']:
        split = row['split']
        assert split in ('train', 'validation', 'test', 'challenge')
        for key, groups in [('activity', activities), ('family', families)]:
            assert row[key] not in groups or groups[row[key]] == split, 'Group overlap'
            groups[row[key]] = split
        assert row['trajectory'] not in trajectories, 'Duplicate trajectory'
        trajectories.add(row['trajectory'])
        assert row['features'] == vector(row['raw']), 'Outcome/future-derived feature'
        assert row['feature_day'] <= row['prediction_day'] < row['horizon_day']
        assert row['horizon_day'] <= row['prediction_day'] + SCHEMA['horizonDays']
        assert all(e['day'] < row['prediction_day'] for e in row['observed_events'])
        assert all(row['prediction_day'] < e['day'] <= row['horizon_day'] for e in row['future_events'])
        assert row['label'] == int(any(e['blocked'] for e in row['future_events']))
        assert all(e['amount_sen'] >= 0 for e in row['observed_events'] + row['future_events'])
    return {s: dict(Counter(r['label'] for r in data['rows'] if r['split'] == s))
            for s in ('train', 'validation', 'test', 'challenge')}


if __name__ == '__main__':
    path = ROOT / 'dataset.json'
    data = json.loads(path.read_text())
    counts = validate(data)
    report = dict(counts=counts, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                  activities=len(data['rows']), feature_names=[f['name'] for f in SCHEMA['features']])
    (ROOT / 'data-validation.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
