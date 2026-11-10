// Reassess saved REAL generations after a validation-only fix; never invent outputs.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
await build({entryPoints:['src/domain/assistant-answer.ts'],outdir:'.local/phase07/assessment-runtime',
  bundle:true,format:'esm',platform:'node'});
const {validateQwenAnswer}=await import(pathToFileURL(resolve('.local/phase07/assessment-runtime/assistant-answer.js')));
const data=JSON.parse(readFileSync('.local/phase07/evaluation.json'));
for(const row of data.rows){
  const output=row.outputs.withContext;
  const accepted=!row.denied&&output.tokens<128?validateQwenAnswer(output.text,row.context):null;
  row.hybrid={text:accepted??row.deterministic,method:accepted?'Qwen':'Deterministic fallback'};
  if(output)output.validated=Boolean(accepted);
}
data.validationReassessment={at:new Date().toISOString(),
  sourceSha256:createHash('sha256').update(readFileSync('src/domain/assistant-answer.ts')).digest('hex'),
  note:'No generation rerun: same saved real model outputs, current validation gate only.'};
writeFileSync('.local/phase07/evaluation-assessed.json',JSON.stringify(data,null,2));
const authorized=data.rows.filter(r=>!r.denied), accepted=authorized.filter(r=>r.hybrid.method==='Qwen');
const latency=authorized.map(r=>r.outputs.withContext.milliseconds).sort((a,b)=>a-b);
const summary={total:data.rows.length,authorized:authorized.length,denied:data.rows.length-authorized.length,
  generatedAccepted:accepted.length,generatedRejected:authorized.length-accepted.length,
  contextLatencyMs:{min:latency[0],median:latency[Math.floor(latency.length/2)],p95:latency[Math.ceil(latency.length*.95)-1],max:latency.at(-1)},
  nonEnglishCases:authorized.filter(r=>r.language!=='en').map(r=>({id:r.id,requested:r.language,method:r.hybrid.method})),
  initializedMs:data.initializedMs,rssBytes:data.rssBytes,
  warning:'Acceptance is a heuristic check, not factual accuracy. Human review must be reported separately.'};
writeFileSync('.local/phase07/evaluation-summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
