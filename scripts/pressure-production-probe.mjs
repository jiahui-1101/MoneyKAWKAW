// Disposable SYNTHETIC verification page in ignored dist; never a release entry.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const worker = readdirSync('dist/assets').find((name) => /^pressure-model\.worker-.*\.js$/.test(name));
if (!worker) throw new Error('Build the application before creating this probe.');
const reference = JSON.parse(readFileSync('.local/phase06/parity-input.json'));
const values = reference.rows[0], expected = reference.scores[0];
writeFileSync('dist/__pressure-test.html', `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Synthetic compiled LightGBM verification</title><body><h1>Synthetic compiled LightGBM verification</h1>
<p>This disposable local probe contains no club records. Do not deploy this page.</p>
<button id="run">Run compiled model</button><pre id="result">Not run</pre><script type="module">
const worker = new Worker('/assets/${worker}', {type:'module'});
const values = ${JSON.stringify(values)}, expected = ${expected};
let cold, warm=[], next=0, started;
document.querySelector('#run').onclick=()=>{cold=undefined;warm=[];next=0;started=performance.now();worker.postMessage({id:'0',values})};
worker.onmessage=({data})=>{
 if(data.error){document.querySelector('#result').textContent=JSON.stringify(data);return}
 const delta=Math.abs(data.score-expected);
 if(delta>1e-10)throw new Error('Compiled parity failure');
 if(cold===undefined)cold=performance.now()-started;else warm.push(data.milliseconds);
 document.querySelector('#result').textContent=JSON.stringify({model:data.version,score:data.score,expected,delta,coldMs:cold,
 warmCount:warm.length,warmMedianMs:[...warm].sort((a,b)=>a-b)[Math.floor(warm.length/2)],contributions:data.contributions},null,2);
 if(++next<101)worker.postMessage({id:String(next),values});
};
</script></body></html>`);
console.log('Created disposable compiled pressure verification page in ignored dist.');
