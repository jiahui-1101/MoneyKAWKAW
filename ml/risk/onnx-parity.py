"""Measure float32 ONNX conversion, including threshold-neighbour inputs."""
import json
import numpy as np
import onnxruntime as ort
from simulate import ROOT

data = json.loads((ROOT / 'parity-input.json').read_text())
x = np.array([[np.nan if v is None else v for v in row] for row in data['rows']], dtype=np.float32)
session = ort.InferenceSession(str(ROOT / 'model.onnx'), providers=['CPUExecutionProvider'])
score = session.run(None, {'features': x})[1][:, 1]
reference = np.array(data['scores'])
delta = np.abs(reference - score)
result = dict(examples=len(x), max_delta=float(delta.max()), median_delta=float(np.median(delta)),
              classification_disagreements=int(np.sum((score >= .5) != (reference >= .5))),
              over_runtime_tolerance=int(np.sum(delta > 1e-4)),
              note='Float32 rounding near split thresholds can choose a different leaf; live worker rejects explanation mismatch >1e-4')
(ROOT / 'onnx-parity.json').write_text(json.dumps(result, indent=2))
assert np.isfinite(score).all() and np.all((score >= 0) & (score <= 1))
print(json.dumps(result))
