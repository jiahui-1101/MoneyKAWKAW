"""Artifact acceptance tests execute the actual trained checkpoint and exported graph."""
import hashlib
import json
import unittest
from pathlib import Path
import numpy as np
import onnxruntime as ort
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sources import ROOT
from labels import LABELS
from train import digest

class TrainedArtifact(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(4)
        cls.tokenizer = AutoTokenizer.from_pretrained('public/models/receipt-bert')
        cls.model = AutoModelForSequenceClassification.from_pretrained(ROOT/'checkpoint', attn_implementation='eager').eval()
        options=ort.SessionOptions(); options.intra_op_num_threads=4
        cls.session=ort.InferenceSession(str(ROOT/'onnx/model_quantized.onnx'),sess_options=options,providers=['CPUExecutionProvider'])

    def test_completed_updates_changed_encoder_and_match_data(self):
        proof=json.loads((ROOT/'training.json').read_text(encoding='utf8'))
        self.assertGreater(proof['completedSteps'],0)
        self.assertEqual(len(proof['history']),proof['config']['epochs'])
        self.assertEqual(proof['datasetSHA256'],hashlib.sha256((ROOT/'prepared.json').read_bytes()).hexdigest())
        self.assertNotEqual(proof['beforeEncoderSHA256'],digest(self.model.distilbert.transformer.layer[5].ffn.lin1.weight))

    def test_tokenization_and_checkpoint_contract(self):
        encoded=self.tokenizer(['Long receipt description '*100],truncation=True,return_tensors='pt')
        self.assertEqual(encoded['input_ids'].shape[1],48)
        self.assertEqual([self.model.config.id2label[i]for i in range(9)],LABELS)
        with torch.no_grad():
            logits=self.model(**encoded).logits
        self.assertEqual(tuple(logits.shape),(1,9)); self.assertTrue(torch.isfinite(logits).all())

    def test_real_quantized_cpu_inference(self):
        tokens=self.tokenizer(['TOTAL 125.00','2026-11-05'],padding=True,return_tensors='np')
        logits=self.session.run(None,dict(tokens))[0]
        self.assertEqual(logits.shape,(2,9)); self.assertTrue(np.isfinite(logits).all())
        self.assertEqual(LABELS[int(logits[0].argmax())],'GRAND_TOTAL')

    def test_browser_artifact_identity_and_parity_evidence(self):
        browser=Path('public/models/receipt-bert')
        manifest=json.loads((browser/'manifest.json').read_text(encoding='utf8'))
        self.assertEqual(manifest['sha256'],hashlib.sha256((browser/'onnx/model_quantized.onnx').read_bytes()).hexdigest())
        self.assertEqual(manifest['parity']['model.onnx']['top1Agreement'],1)
        self.assertGreaterEqual(manifest['parity']['model_quantized.onnx']['top1Agreement'],.95)

if __name__=='__main__':
    unittest.main()
