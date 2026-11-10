// Run with Node --no-js-float16array for the locked native ORT prerelease.
import { pipeline, env, TextStreamer } from '@huggingface/transformers';
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
await build({entryPoints:['src/domain/assistant-answer.ts','src/domain/assistant.ts'],outdir:'.local/phase07/eval-runtime',
  bundle:true,format:'esm',platform:'node'});
const {deterministicAnswer,qwenPrompt,validateQwenAnswer}=await import(pathToFileURL(resolve('.local/phase07/eval-runtime/assistant-answer.js')));
const {assistantLanguage}=await import(pathToFileURL(resolve('.local/phase07/eval-runtime/assistant.js')));
const data=JSON.parse(readFileSync('.local/phase07/evaluation-contexts.json'));
const manifest=JSON.parse(readFileSync('public/models/qwen-assistant/manifest.json'));
env.allowRemoteModels=false;env.localModelPath=resolve('public/models')+'/';
const started=performance.now();
const model=await pipeline('text-generation',manifest.directory,{dtype:'q4f16',device:'cpu'});
const initializedMs=performance.now()-started;
const prior=process.argv.includes('--append-only')?JSON.parse(readFileSync('.local/phase07/evaluation.json')):null;
const rows=prior?.rows??[];
const score=(text,context)=>{
  if(!context)return {statusMentioned:null,unsupportedNumbers:null,validated:null};
  const reference=deterministicAnswer(context), nums=s=>(s.replace(/(?<=\d),(?=\d)/g,'').match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
  const allowed=new Set(nums(reference));
  return {statusMentioned:context.values.status?text.toLowerCase().includes(context.values.status.toLowerCase()):null,
    unsupportedNumbers:nums(text).filter(n=>!allowed.has(n)),validated:Boolean(validateQwenAnswer(text,context))};
};
for(const c of data){
  if(rows.some(r=>r.id===c.id))continue;
  const outputs={};
  for(const mode of ['withoutContext','withContext']){
    if(mode==='withContext'&&c.denied)continue;
    const prompt=mode==='withContext'?qwenPrompt(c.context,assistantLanguage(c.question)):
      {system:'You are a read-only financial assistant. No club records have been supplied. Do not invent facts or claim access. Reply briefly.',user:c.question};
    const formatted=model.tokenizer.apply_chat_template([{role:'system',content:prompt.system},{role:'user',content:prompt.user}],
      {tokenize:false,add_generation_prompt:true,enable_thinking:false});
    const start=performance.now();
    let tokens=0;
    const streamer=new TextStreamer(model.tokenizer,{skip_prompt:true,callback_function:()=>{},token_callback_function:()=>tokens++});
    const result=await model(formatted,{max_new_tokens:128,do_sample:false,return_full_text:false,streamer});
    const text=result[0].generated_text;
    outputs[mode]={text,tokens,milliseconds:performance.now()-start,...score(text,c.context)};
  }
  const deterministic=c.denied?'No authorized context is available. Private records and financial actions cannot be requested through this assistant.':deterministicAnswer(c.context);
  const accepted=!c.denied&&outputs.withContext.tokens<128?validateQwenAnswer(outputs.withContext.text,c.context):null;
  rows.push({id:c.id,role:c.role,language:assistantLanguage(c.question),denied:Boolean(c.denied),context:c.context,
    deterministic,outputs,hybrid:{text:accepted??deterministic,method:accepted?'Qwen':'Deterministic fallback'},
    note:'Automated checks are limited; use the documented human financial-grounding rubric.'});
  writeFileSync('.local/phase07/evaluation.json',JSON.stringify({model:manifest.version,initializedMs:prior?.initializedMs??initializedMs,
    appendedInitializationMs:prior?initializedMs:undefined,rssBytes:Math.max(prior?.rssBytes??0,process.memoryUsage().rss),rows},null,2));
  console.log(c.id,'completed',accepted?'Qwen accepted':'deterministic retained');
}
await model.dispose();
