import hashlib
import json
import unittest
import lightgbm as lgb
import numpy as np
from schema import NAMES
from simulate import ROOT


class ModelTests(unittest.TestCase):
    def test_actual_checkpoint_and_training(self):
        log = json.loads((ROOT / 'training.json').read_text())
        model = lgb.Booster(model_file=str(ROOT / 'model.txt'))
        self.assertEqual(model.feature_name(), NAMES)
        self.assertGreater(model.current_iteration(), 1)
        self.assertGreater(log['examples'], 1000)
        self.assertLess(log['reproducibility_max_delta'], 1e-12)
        self.assertEqual(log['model_sha256'], hashlib.sha256((ROOT / 'model.txt').read_bytes()).hexdigest())
        x = np.zeros((3, len(NAMES)))
        x[1] = np.nan
        score = model.predict(x)
        self.assertTrue(np.isfinite(score).all())
        self.assertTrue(((score >= 0) & (score <= 1)).all())

    def test_export_and_native_parity_evidence(self):
        m = json.loads((ROOT / 'export.json').read_text())
        path = ROOT.parent.parent / 'public/models/budget-pressure' / m['file']
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), m['sha256'])
        artifact = json.loads(path.read_text())
        self.assertEqual(len(artifact['trees']), m['iterations'])
        parity = json.loads((ROOT / 'parity.json').read_text())
        self.assertGreater(parity['examples'], 10000)
        self.assertLess(parity['maxDelta'], 1e-10)
        self.assertEqual(parity['disagreement'], 0)


if __name__ == '__main__':
    unittest.main()
