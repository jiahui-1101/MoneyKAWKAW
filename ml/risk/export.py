"""Export actual learned numeric trees, plus optional ONNX compatibility probe."""
import hashlib
import json
from pathlib import Path
import lightgbm as lgb
import numpy as np
from schema import NAMES, SCHEMA
from simulate import ROOT


def compact(node):
    if 'leaf_value' in node:
        return dict(value=node['leaf_value'], count=node['leaf_count'])
    assert node['decision_type'] == '<=' and node['missing_type'] in ('None', 'NaN')
    left, right = compact(node['left_child']), compact(node['right_child'])
    count = left['count'] + right['count']
    # Path attribution = child minus parent weighted training-leaf expectation.
    value = (left['value'] * left['count'] + right['value'] * right['count']) / count
    return dict(feature=node['split_feature'], threshold=node['threshold'],
                defaultLeft=node['default_left'], left=left, right=right, count=count, value=value)


def export():
    model = lgb.Booster(model_file=str(ROOT / 'model.txt'))
    assert model.feature_name() == NAMES
    dump = model.dump_model()
    assert dump['objective'] == 'binary sigmoid:1'
    artifact = dict(schema=SCHEMA['version'], features=NAMES, format='lightgbm-numeric-trees-v1',
                    trees=[compact(t['tree_structure']) for t in dump['tree_info']])
    encoded = json.dumps(artifact, separators=(',', ':')).encode()
    digest = hashlib.sha256(encoded).hexdigest()
    out = Path('public/models/budget-pressure')
    out.mkdir(parents=True, exist_ok=True)
    (out / f'{digest}.json').write_bytes(encoded)
    training = json.loads((ROOT / 'training.json').read_text())
    manifest = dict(name='LightGBM future budget pressure', version=f'pressure-v1:{digest[:12]}',
                    sha256=digest, file=f'{digest}.json', featureSchema=SCHEMA['version'],
                    trainedAt=training['trained_at'], dataset='SYNTHETIC', experimental=True,
                    horizonDays=30, target='Future demand or approval blocked by department budget',
                    realWorldValidation=False, iterations=model.current_iteration(), bytes=len(encoded))
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (ROOT / 'export.json').write_text(json.dumps(manifest, indent=2))
    # ONNX uses ai.onnx.ml tree operators; evaluate separately from JS deployment.
    try:
        import onnxmltools
        from onnxmltools.convert.common.data_types import FloatTensorType
        import onnxruntime as ort
        graph = onnxmltools.convert_lightgbm(model, initial_types=[('features', FloatTensorType([None, len(NAMES)]))])
        onnxmltools.utils.save_model(graph, str(ROOT / 'model.onnx'))
        session = ort.InferenceSession(str(ROOT / 'model.onnx'), providers=['CPUExecutionProvider'])
        x = np.array([r['features'] for r in json.loads((ROOT / 'dataset.json').read_text())['rows'][:200]], dtype=np.float32)
        output = session.run(None, {'features': x})[1]
        score = np.array([v[1] for v in output]) if isinstance(output, list) else output[:, 1]
        probe = dict(success=True, max_delta=float(np.max(np.abs(score - model.predict(x)))),
                     operators=sorted({f'{n.domain}:{n.op_type}' for n in graph.graph.node}))
    except Exception as error:
        probe = dict(success=False, error=str(error))
    (ROOT / 'onnx-probe.json').write_text(json.dumps(probe, indent=2))
    print(json.dumps(manifest))


if __name__ == '__main__':
    export()
