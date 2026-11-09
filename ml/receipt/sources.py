"""Download only public annotation columns, never private application data."""
import hashlib
import json
from pathlib import Path
import requests
import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem

ROOT = Path('.local/phase05')
MODEL_SOURCE = {'repo': 'distilbert/distilbert-base-multilingual-cased',
                'revision': '45c032ab32cc946ad88a166f7cb282f58c753c2e', 'license': 'Apache-2.0'}
SOURCES = {
    'cord': ('naver-clova-ix/cord-v1', '64fe41966657fbf60c1443a84143a2081dbd50a6', ['ground_truth']),
    'sroie': ('jsdnrs/ICDAR2019-SROIE', 'bffe40c26759f3376ec2b3ae9031dbba54cd587c', ['key', 'entities', 'words', 'bboxes']),
}

def fetch_sources():
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'base-model.json').write_text(json.dumps(MODEL_SOURCE), encoding='utf8')
    fs = HfFileSystem(token=False)
    manifest = {}
    for name, (repo, revision, columns) in SOURCES.items():
        response = requests.get(f'https://huggingface.co/api/datasets/{repo}/revision/{revision}', timeout=60)
        response.raise_for_status()
        files = [x['rfilename'] for x in response.json()['siblings'] if x['rfilename'].endswith('.parquet')]
        documents = []
        for file in files:
            split = Path(file).name.split('-')[0]
            cache = ROOT / 'source' / name / (Path(file).name + '.json')
            cache.parent.mkdir(parents=True, exist_ok=True)
            if cache.exists():
                rows = json.loads(cache.read_text(encoding='utf8'))
            else:
                with fs.open(f'datasets/{repo}@{revision}/{file}', 'rb') as stream:
                    rows = pq.ParquetFile(stream).read(columns=columns).to_pylist()
                cache.write_text(json.dumps(rows, ensure_ascii=False), encoding='utf8')
            for index, row in enumerate(rows):
                documents.append({'id': f'{name}/{file}/{index}', 'source': name, 'official_split': split, 'data': row})
            print(name, file, len(rows), flush=True)
        target = ROOT / f'{name}.json'
        target.write_text(json.dumps(documents, ensure_ascii=False), encoding='utf8')
        manifest[name] = {'repo': repo, 'revision': revision, 'license': 'CC-BY-4.0',
                          'documents': len(documents), 'columns': columns,
                          'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'files': files}
    (ROOT / 'sources.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')

if __name__ == '__main__':
    fetch_sources()
