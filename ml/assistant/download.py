"""Download only pinned public Qwen model assets; never send application data."""
import argparse
import hashlib
import json
from pathlib import Path
import requests

CANDIDATES = {
    'qwen3': ('onnx-community/Qwen3-0.6B-ONNX', '58ca03a5e7b354b480b1a82b34bde8dc7b854cc0',
              'Qwen/Qwen3-0.6B', 'c1899de289a04d12100db370d81485cdf75e47ca'),
    'qwen25': ('onnx-community/Qwen2.5-0.5B-Instruct', '22942cb7d7ba4cc81bb4673549ca4d4614469b5e',
               'Qwen/Qwen2.5-0.5B-Instruct', '7ae557604adf67be50417f59c2c2f167def9a775'),
}


def download(candidate, dtype='q4f16', activate=False):
    repo, revision, base, base_revision = CANDIDATES[candidate]
    metadata = requests.get(f'https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true', timeout=60)
    metadata.raise_for_status()
    sources = {f['rfilename']: f for f in metadata.json()['siblings']}
    directory = f'qwen-assistant/{candidate}-{revision[:12]}-{dtype}'
    out = Path('public/models') / directory
    out.mkdir(parents=True, exist_ok=True)
    names = ['config.json', 'generation_config.json', 'tokenizer.json', 'tokenizer_config.json',
             'special_tokens_map.json', f'onnx/model_{dtype}.onnx']
    files = []
    for name in names:
        if name not in sources:
            if name in ('special_tokens_map.json', 'generation_config.json'):
                continue
            raise ValueError(f'Missing pinned asset {name}')
        expected = sources[name].get('lfs', {}).get('sha256')
        path = out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.stat().st_size != sources[name]['size']:
            response = requests.get(f'https://huggingface.co/{repo}/resolve/{revision}/{name}', stream=True, timeout=120)
            response.raise_for_status()
            temporary = path.with_suffix(path.suffix + '.partial')
            with temporary.open('wb') as stream:
                for chunk in response.iter_content(8 * 1024 * 1024):
                    stream.write(chunk)
            temporary.replace(path)
        digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
        if expected and digest != expected:
            raise ValueError(f'Checksum mismatch: {name}')
        files.append(dict(path=name, sha256=digest, bytes=path.stat().st_size))
        print(candidate, name, path.stat().st_size, flush=True)
    license_response = requests.get(f'https://huggingface.co/{base}/resolve/{base_revision}/LICENSE', timeout=60)
    license_response.raise_for_status()
    (out / 'LICENSE').write_bytes(license_response.content)
    manifest = dict(id='qwen-assistant-v1', candidate=candidate, repo=repo, revision=revision,
                    base=base, baseRevision=base_revision, license='Apache-2.0', dtype=dtype,
                    directory=directory, files=files, totalBytes=sum(f['bytes'] for f in files),
                    version=f'{candidate}:{files[-1]["sha256"][:12]}', maxInputTokens=1024, maxNewTokens=128)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    Path('.local/phase07').mkdir(parents=True, exist_ok=True)
    Path(f'.local/phase07/{candidate}-{dtype}-manifest.json').write_text(json.dumps(manifest, indent=2))
    if activate:
        if candidate != 'qwen3' or dtype != 'q4f16':
            raise ValueError('Only the verified Qwen3 q4f16 artifact can be activated')
        (Path('public/models/qwen-assistant') / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print(json.dumps({'candidate': candidate, 'bytes': manifest['totalBytes'], 'version': manifest['version']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate', choices=CANDIDATES, default='qwen3')
    parser.add_argument('--dtype', choices=['q4f16', 'q4'], default='q4f16')
    parser.add_argument('--activate', action='store_true')
    args = parser.parse_args()
    download(args.candidate, args.dtype, args.activate)
