"""One held-out evaluation; noise variants inherit their original document split."""
import json
import random
import subprocess
import time
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer
from sources import ROOT
from labels import LABELS
from train import metrics
from probes import probes

def predict(session, tokenizer, texts):
    result = []; durations = []
    for start in range(0, len(texts), 32):
        inputs = tokenizer(texts[start:start+32], padding=True, truncation=True, max_length=48, return_tensors='np')
        started = time.perf_counter()
        logits = session.run(None, dict(inputs))[0]
        durations.append(time.perf_counter()-started)
        values = np.exp(logits - logits.max(axis=-1, keepdims=True)); values /= values.sum(axis=-1, keepdims=True)
        result.extend({'label': LABELS[int(row.argmax())], 'score': float(row.max())} for row in values)
    return result, durations

def main():
    clean = [d for d in json.loads((ROOT/'prepared.json').read_text(encoding='utf8')) if d['split']=='test']
    documents = [dict(d, variant='clean') for d in clean] + [dict(d, variant='synthetic') for d in probes()]
    rng = random.Random(2026)
    for d in clean:
        rows = [{'text': ''.join('0' if c=='O' and rng.random()<.25 else '1' if c=='l' and rng.random()<.25 else c for c in r['text']), 'label': r['label']} for r in d['rows']]
        documents.append(dict(d, id=d['id']+'/noise', rows=rows, variant='simulated-noise'))
        documents.append(dict(d, id=d['id']+'/partial', rows=[r for i,r in enumerate(d['rows']) if i%5 != 2], variant='missing-lines'))
    (ROOT/'evaluation-documents.json').write_text(json.dumps(documents, ensure_ascii=False), encoding='utf8')
    tokenizer = AutoTokenizer.from_pretrained('public/models/receipt-bert')
    options=ort.SessionOptions(); options.intra_op_num_threads=4
    session=ort.InferenceSession(str(ROOT/'onnx/model_quantized.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
    texts=[r['text'] for d in documents for r in d['rows']]
    predicted, durations=predict(session, tokenizer, texts)
    output={}; offset=0
    for d in documents:
        output[d['id']]=[dict(p,text=r['text']) for p,r in zip(predicted[offset:offset+len(d['rows'])],d['rows'])]
        offset+=len(d['rows'])
    (ROOT/'test-predictions.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf8')
    subprocess.run(['node','ml/receipt/baseline.mjs'],check=True)
    baseline={r['id']:r for r in json.loads((ROOT/'baseline.json').read_text(encoding='utf8'))}
    results={}
    for variant in ('clean','simulated-noise','missing-lines','synthetic'):
        selected=[d for d in documents if d['variant']==variant]
        results[variant]={}
        for method in ('baseline','bert','hybrid'):
            gold=[]; guesses=[]; edits=0; complete=0; eligible=0
            for d in selected:
                predictions=[p['label'] for p in output[d['id']]] if method=='bert' else baseline[d['id']][method]
                for r,p in zip(d['rows'],predictions):
                    if r['label'] is not None:
                        gold.append(LABELS.index(r['label'])); guesses.append(LABELS.index(p))
                # Only sources with full item annotations support a selection-edit proxy.
                if d['source']!='sroie':
                    actual={i for i,r in enumerate(d['rows']) if r['label']=='ITEM_DESCRIPTION'}
                    found={i for i,p in enumerate(predictions) if p=='ITEM_DESCRIPTION'}
                    edits+=len(actual ^ found); complete+=actual==found; eligible+=1
            results[variant][method]=metrics(gold,guesses)|{'selectionEditProxy':edits,
                'fullyAnnotatedItemReceipts':eligible,'exactItemSelectionReceiptRate':complete/eligible if eligible else None}
    results['runtime']={'batchSize':32,'totalLines':len(texts),'medianBatchMs':float(np.median(durations)*1000),
                        'p95BatchMs':float(np.percentile(durations,95)*1000),'inferenceSeconds':sum(durations)}
    (ROOT/'evaluation.json').write_text(json.dumps(results,indent=2),encoding='utf8')
    print(json.dumps({k:{m:round(r['report']['macro avg']['f1-score'],4) for m,r in v.items()} for k,v in results.items() if k!='runtime'}),flush=True)

if __name__=='__main__':
    main()
