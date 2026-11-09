"""Annotation-derived OCR rows. Unlabelled SROIE rows are NOT negative item labels."""
import hashlib
import json
import re
from collections import defaultdict, Counter
from pathlib import Path
from labels import cord_label, normalize, LABELS
from sources import ROOT

def cord_rows(data):
    gt = json.loads(data['ground_truth'])
    grouped = defaultdict(list)
    for line in gt['valid_line']:
        for word in line['words']:
            grouped[word['row_id']].append((word['quad']['x1'], word['text'], line['category']))
    return [{'text': normalize(' '.join(w[1] for w in sorted(words))),
             'label': cord_label([w[2] for w in words])} for _, words in sorted(grouped.items())]

def sroie_rows(data):
    groups = defaultdict(list)
    for text, box in zip(data['words'], data['bboxes']):
        groups[tuple(box)].append(text)
    entities = {k: normalize(v).upper() for k, v in data['entities'].items()}
    rows = []
    for box, words in sorted(groups.items(), key=lambda p: (p[0][1], p[0][0])):
        text = normalize(' '.join(words))
        upper = text.upper()
        label = None
        for field, target in [('company', 'MERCHANT'), ('date', 'RECEIPT_DATE'), ('total', 'GRAND_TOTAL')]:
            entity = entities[field]
            if entity and (entity in upper or (field == 'company' and len(upper) > 4 and upper in entity)):
                # A bare amount repeated elsewhere is ambiguous: only total-tagged rows are mapped.
                if field != 'total' or re.search(r'\b(?:GRAND\s+)?TOTAL\b', upper):
                    label = target
                    break
        rows.append({'text': text, 'label': label})
    return rows

def signature(doc):
    return re.sub(r'\d+(?:[.,:/-]\d+)*', '#', '\n'.join(r['text'].lower() for r in doc['rows']))

def assign_splits(docs):
    parents = list(range(len(docs)))
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    # Conservative family grouping: SROIE company, CORD normalized non-item footer.
    # This intentionally groups common receipt templates together, even at cost of split balance.
    families = {}
    shingles = []
    for i, doc in enumerate(docs):
        sig = signature(doc)
        tokens = sig.split()
        shingles.append(set(zip(tokens, tokens[1:], tokens[2:])))
        family = doc.get('family') or doc['source'] + ':' + re.sub(r'\d', '#', '\n'.join(
            r['text'].lower() for r in doc['rows'] if r['label'] not in ('ITEM_DESCRIPTION', 'OTHER', None)))
        if family in families:
            parents[root(i)] = root(families[family])
        else:
            families[family] = i
        for j in range(i):
            a, b = shingles[i], shingles[j]
            if a and b and len(a & b) / len(a | b) >= .85:
                parents[root(i)] = root(j)
    groups = defaultdict(list)
    for i, doc in enumerate(docs):
        groups[root(i)].append(doc)
    for members in groups.values():
        key = min(d['id'] for d in members)
        value = int(hashlib.sha256(('receipt-v1:' + key).encode()).hexdigest()[:8], 16) % 100
        split = 'train' if value < 75 else 'validation' if value < 87 else 'test'
        for doc in members:
            doc.update(group=key, split=split)
    return docs

def prepare():
    docs = []
    for source in ('cord', 'sroie'):
        for doc in json.loads((ROOT / f'{source}.json').read_text(encoding='utf8')):
            rows = cord_rows(doc['data']) if source == 'cord' else sroie_rows(doc['data'])
            family = 'sroie:' + normalize(doc['data']['entities']['company']).lower() if source == 'sroie' else None
            docs.append({k: doc[k] for k in ('id', 'source', 'official_split')} | {'rows': rows, 'family': family})
    docs = assign_splits(docs)
    target = ROOT / 'prepared.json'
    target.write_text(json.dumps(docs, ensure_ascii=False), encoding='utf8')
    stats = {'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'labels': LABELS, 'receipts': len(docs),
             'splits': {s: {'receipts': sum(d['split'] == s for d in docs),
                           'classes': dict(Counter(r['label'] for d in docs if d['split'] == s for r in d['rows'] if r['label']))}
                        for s in ('train', 'validation', 'test')},
             'groups': len(set(d['group'] for d in docs)), 'unlabelledRows': sum(r['label'] is None for d in docs for r in d['rows'])}
    (ROOT / 'dataset-statistics.json').write_text(json.dumps(stats, indent=2), encoding='utf8')
    print(json.dumps(stats), flush=True)

if __name__ == '__main__':
    prepare()
