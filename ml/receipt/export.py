"""Export the actual selected checkpoint, quantize embeddings and run real parity checks."""
import hashlib
import json
import shutil
import time
from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sources import ROOT

def main():
    torch.set_num_threads(4)
    checkpoint = ROOT / 'checkpoint'
    model = AutoModelForSequenceClassification.from_pretrained(checkpoint, attn_implementation='eager').eval()
    tokenizer = AutoTokenizer.from_pretrained(checkpoint)
    tokenizer.model_max_length = 48
    target = ROOT / 'onnx'
    target.mkdir(exist_ok=True)
    tokens = tokenizer(['Example item 12.50', 'TOTAL 12.50'], padding=True, return_tensors='pt')
    class Export(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.model = model
        def forward(self, input_ids, attention_mask):
            return self.model(input_ids=input_ids, attention_mask=attention_mask).logits
    # Official torch exporter with dynamic batch/sequence; no external ONNX data files.
    torch.onnx.export(Export().eval(), (tokens['input_ids'], tokens['attention_mask']), target/'model.onnx',
        input_names=['input_ids', 'attention_mask'], output_names=['logits'], opset_version=17,
        dynamic_axes={'input_ids': {0: 'batch', 1: 'sequence'}, 'attention_mask': {0: 'batch', 1: 'sequence'}, 'logits': {0: 'batch'}},
        dynamo=False, external_data=False)
    onnx.checker.check_model(str(target/'model.onnx'))
    quantize_dynamic(str(target/'model.onnx'), str(target/'model_quantized.onnx'),
        weight_type=QuantType.QUInt8, op_types_to_quantize=['MatMul', 'Gemm', 'Gather'], per_channel=False)
    documents = json.loads((ROOT/'prepared.json').read_text(encoding='utf8'))
    samples = [r['text'] for d in documents if d['split'] == 'validation' for r in d['rows']][:128]
    samples += ['HDMI Cable 110.00', 'TOTAL 125.00', 'Personal snacks 15.00', '打印纸 12.00', 'JUMLAH RM 40.00']
    encoded = tokenizer(samples, padding=True, truncation=True, return_tensors='pt')
    model.eval()
    with torch.no_grad():
        expected = model(**encoded).logits.numpy()
    options = ort.SessionOptions(); options.intra_op_num_threads = 4
    results = {}
    for filename in ('model.onnx', 'model_quantized.onnx'):
        started = time.perf_counter()
        session = ort.InferenceSession(str(target/filename), sess_options=options, providers=['CPUExecutionProvider'])
        logits = session.run(None, {k: v.numpy() for k, v in encoded.items()})[0]
        results[filename] = {'bytes': (target/filename).stat().st_size,
            'top1Agreement': float(np.mean(expected.argmax(-1) == logits.argmax(-1))),
            'maxAbsoluteLogitDifference': float(np.max(np.abs(expected-logits))),
            'loadAndInferenceSeconds': time.perf_counter()-started}
    print(json.dumps(results), flush=True)
    assert results['model.onnx']['top1Agreement'] == 1.0
    assert results['model_quantized.onnx']['top1Agreement'] >= .95
    sha256 = hashlib.sha256((target/'model_quantized.onnx').read_bytes()).hexdigest()
    directory = f'receipt-bert/{sha256[:12]}'
    browser = Path('public/models') / directory; (browser/'onnx').mkdir(parents=True, exist_ok=True)
    tokenizer.save_pretrained(browser); model.config.save_pretrained(browser)
    shutil.copy2(target/'model_quantized.onnx', browser/'onnx/model_quantized.onnx')
    manifest = {'id': 'receipt-bert-v1', 'experimental': True, 'source': json.loads((ROOT/'base-model.json').read_text()),
        'training': json.loads((ROOT/'training.json').read_text()), 'parity': results,
        'sha256': sha256, 'artifactDirectory': directory,
        'maxLength': 48, 'classificationTask': 'semantic-line', 'license': 'Apache-2.0; training annotations CC-BY-4.0'}
    (Path('public/models/receipt-bert')/'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    # Retire only known flat generated files; versioned assets prevent stale browser cache reuse.
    legacy=Path('public/models/receipt-bert')
    for file in ('config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','vocab.txt','onnx/model_quantized.onnx'):
        (legacy/file).unlink(missing_ok=True)
    (ROOT/'export.json').write_text(json.dumps(results, indent=2), encoding='utf8')
    print(json.dumps(results), flush=True)

if __name__ == '__main__':
    main()
