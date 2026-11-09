"""Real CPU encoder fine-tuning; select on validation only, never test."""
import argparse
import hashlib
import json
import random
import time
from collections import Counter
import numpy as np
import psutil
import torch
from sklearn.metrics import classification_report, confusion_matrix
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from labels import LABELS
from sources import ROOT

def digest(tensor):
    return hashlib.sha256(tensor.detach().cpu().numpy().tobytes()).hexdigest()

def rows_for(docs, split):
    return [r for d in docs if d['split'] == split for r in d['rows'] if r['label'] in LABELS and r['text']]

def metrics(labels, predictions):
    return {'report': classification_report(labels, predictions, labels=list(range(len(LABELS))),
                target_names=LABELS, output_dict=True, zero_division=0),
            'confusionMatrix': confusion_matrix(labels, predictions, labels=list(range(len(LABELS)))).tolist()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=3)
    parser.add_argument('--batch', type=int, default=32)
    parser.add_argument('--lr', type=float, default=3e-5)
    parser.add_argument('--threads', type=int, default=6)
    args = parser.parse_args()
    torch.set_num_threads(args.threads)
    random.seed(2026); np.random.seed(2026); torch.manual_seed(2026)
    torch.use_deterministic_algorithms(True)
    docs = json.loads((ROOT / 'prepared.json').read_text(encoding='utf8'))
    source = json.loads((ROOT / 'base-model.json').read_text())
    tokenizer = AutoTokenizer.from_pretrained(source['repo'], revision=source['revision'])
    model = AutoModelForSequenceClassification.from_pretrained(source['repo'], revision=source['revision'],
        num_labels=len(LABELS), id2label=dict(enumerate(LABELS)), label2id={l: i for i, l in enumerate(LABELS)}, attn_implementation='eager')
    for name, parameter in model.named_parameters():
        parameter.requires_grad = not name.startswith('distilbert.embeddings.') and not any(
            name.startswith(f'distilbert.transformer.layer.{i}.') for i in range(4))
    tracked = model.distilbert.transformer.layer[5].ffn.lin1.weight
    before = digest(tracked)
    encoded = {}
    for split in ('train', 'validation'):
        rows = rows_for(docs, split)
        tokens = tokenizer([r['text'] for r in rows], padding='max_length', truncation=True, max_length=48, return_tensors='pt')
        encoded[split] = (tokens, torch.tensor([LABELS.index(r['label']) for r in rows]))
    train, gold = encoded['train']
    counts = torch.bincount(gold, minlength=len(LABELS)).float()
    weights = torch.sqrt(len(gold) / counts.clamp(min=1)); weights /= weights.mean()
    optimizer = torch.optim.AdamW((p for p in model.parameters() if p.requires_grad), lr=args.lr)
    criterion = torch.nn.CrossEntropyLoss(weight=weights)
    logs = []; best = -1; steps = 0; started = time.perf_counter()
    destination = ROOT / 'checkpoint'; destination.mkdir(exist_ok=True)
    for epoch in range(args.epochs):
        model.train(); loss_sum = 0
        order = torch.randperm(len(gold))
        for start in range(0, len(gold), args.batch):
            indices = order[start:start + args.batch]
            optimizer.zero_grad(set_to_none=True)
            output = model(**{k: v[indices] for k, v in train.items()}).logits
            loss = criterion(output, gold[indices]); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); optimizer.step()
            steps += 1; loss_sum += loss.item() * len(indices)
            if steps % 25 == 0:
                print(json.dumps({'step': steps, 'loss': loss.item(), 'seconds': round(time.perf_counter()-started, 2),
                                  'rssMB': psutil.Process().memory_info().rss / 2**20}), flush=True)
        model.eval(); predicted = []; validation_loss = 0
        tokens, labels = encoded['validation']
        with torch.no_grad():
            for start in range(0, len(labels), args.batch):
                logits = model(**{k: v[start:start+args.batch] for k, v in tokens.items()}).logits
                validation_loss += criterion(logits, labels[start:start+args.batch]).item() * len(logits)
                predicted.extend(logits.argmax(-1).tolist())
        result = metrics(labels.tolist(), predicted)
        f1 = result['report']['macro avg']['f1-score']
        logs.append({'epoch': epoch+1, 'trainLoss': loss_sum/len(gold), 'validationLoss': validation_loss/len(labels), 'validation': result})
        if f1 > best:
            best = f1; model.save_pretrained(destination); tokenizer.save_pretrained(destination)
        proof = {'source': source, 'datasetSHA256': hashlib.sha256((ROOT/'prepared.json').read_bytes()).hexdigest(),
                 'config': vars(args), 'maxLength': 48, 'seed': 2026, 'completedSteps': steps,
                 'trainingExamples': len(gold), 'classCounts': dict(Counter(gold.tolist())),
                 'trainableParameters': sum(p.numel() for p in model.parameters() if p.requires_grad),
                 'beforeEncoderSHA256': before, 'afterEncoderSHA256': digest(tracked), 'history': logs,
                 'seconds': time.perf_counter()-started, 'bestValidationMacroF1': best}
        (ROOT/'training.json').write_text(json.dumps(proof, indent=2), encoding='utf8')
        print(json.dumps({'epoch': epoch+1, 'validationMacroF1': f1}), flush=True)

if __name__ == '__main__':
    main()
