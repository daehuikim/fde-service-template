import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
if(!process.env.DATABASE_URL) {console.error('blocked: DATABASE_URL required');process.exit(2);}
const token=randomBytes(32).toString('hex'),base='http://127.0.0.1:3100';
const env={...process.env,NODE_ENV:'production',APP_MODE:'live',SERVICE_TOKEN:token,SERVICE_TENANT:'smoke-demo'};
const child=spawn(process.execPath,[path.resolve('apps/web/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3100'],{cwd:'apps/web',env,stdio:['ignore','ignore','pipe']});
let serverError='';child.stderr.on('data',chunk=>serverError+=chunk.toString());
const csv='request_id,title,department,amount\nSMOKE-1,합성 검증,support,1';
async function post(endpoint,body,auth=true){return fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});}
try {
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'server failed to start: '+serverError);
 assert.equal((await post('/api/validate',{csv},false)).status,401);
 const validated=await post('/api/validate',{csv});assert.equal(validated.status,200);assert.equal((await validated.json()).mode,'live');
 const key=randomUUID();const saved=await Promise.all(Array.from({length:10},()=>post('/api/runs',{csv,key})));
 for(const res of saved)assert.equal(res.status,200);const ids=await Promise.all(saved.map(res=>res.json()));assert.equal(new Set(ids.map(r=>r.id)).size,1);
 assert.equal((await post('/api/runs',{csv:csv.replace('support,1','support,2'),key})).status,409);
 mkdirSync('reports',{recursive:true});writeFileSync('reports/live-smoke.json',JSON.stringify({status:'pass',mode:'live',checks:['unauthorized rejection','schema and parser','10 concurrent saves: single ID','idempotency conflict 409'],date:new Date().toISOString()},null,2));console.log('pass: production HTTP + live PostgreSQL smoke');
 if(process.env.K6_BIN){const r=spawnSync(process.env.K6_BIN,['run','--summary-export=reports/load.json','qa/load.js'],{env:{...process.env,BASE_URL:base,SERVICE_TOKEN:token},stdio:'inherit'});assert.equal(r.status,0,'k6 thresholds failed');}
}finally{child.kill('SIGTERM');}
