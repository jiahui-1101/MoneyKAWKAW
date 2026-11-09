// Generate a disposable production-worker check with synthetic text only. Never deploy this page.
import { readdir, writeFile } from 'node:fs/promises';
const files = await readdir('dist/assets');
const worker = files.find(f => /^receipt-model\.worker-.*\.js$/.test(f));
const style = files.find(f => /^index-.*\.css$/.test(f));
if (!worker || !style) throw new Error('Build the application first.');
await writeFile('dist/__receipt-model-test.html', `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/${style}">
<title>Local production model check</title><main class="member-content stack"><h1>Local production model check</h1>
<p>Synthetic text only. This checks the compiled application worker and local model assets.</p>
<button class="btn primary" id="run">Run compiled model</button><pre id="result" aria-live="polite">Not run</pre></main>
<script type="module">
const worker = new Worker('/assets/${worker}', {type:'module'});let started;
worker.onmessage = e => {document.getElementById('result').textContent = JSON.stringify({...e.data,milliseconds:performance.now()-started},null,2)};
worker.onerror = () => {document.getElementById('result').textContent='Compiled worker failed'};
document.getElementById('run').onclick = () => {started=performance.now();document.getElementById('result').textContent='Loading local model…';worker.postMessage({id:1,base:location.origin+'/',rows:['DEMO CLUB SUPPLIES','2026-11-05','HDMI Cable 110.00','Personal snacks 15.00','TOTAL 125.00']})};
</script></html>`);
console.log('Generated disposable production worker probe. Serve dist locally; do not deploy probe.');
