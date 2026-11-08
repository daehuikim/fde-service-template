import {describe,it,expect} from "vitest";
import {runDiscussion,synthesizeTranscript,parseRequest,type AgentProvider,type DiscussionEvent,type LensAgent} from "../packages/agents";
import {fixtureProvider} from "../packages/agents/fixture";
import {samples} from "../packages/agents/samples";
import {synthesize} from "../packages/domain/discussion";
import {assertTranscript,type Transcript} from "../packages/contracts/discussion";
import {POST} from "../apps/web/app/api/discussions/route";
import {POST as login} from "../apps/web/app/api/auth/login/route";

const sample=samples.find(s=>s.id==="etch-cd-drift")!;
const origin="http://localhost";
const req=(body:unknown,headers:Record<string,string>={})=>new Request(origin+"/api/discussions",{method:"POST",headers:{"content-type":"application/json",origin,...headers},body:JSON.stringify(body)});
async function ndjson(r:Response){return (await r.text()).trim().split("\n").map(l=>JSON.parse(l));}

describe("parallel discussion orchestrator",()=>{
 it("runs every lens in round 1 before any review, then cross-reviews in parallel",async()=>{
  const events:DiscussionEvent[]=[];
  const d=await runDiscussion({problem:sample.problem,lenses:sample.lenses},fixtureProvider(),{onEvent:e=>events.push(e)});
  const firstReview=events.findIndex(e=>e.type==="agent"&&e.round===2);
  const lastExplore=events.map((e,i)=>e.type==="agent"&&e.round===1&&e.state==="done"?i:-1).reduce((a,b)=>Math.max(a,b));
  expect(lastExplore).toBeLessThan(firstReview);
  expect(d.positions).toHaveLength(sample.lenses.length);expect(d.failures).toEqual([]);
  expect(d.reviews.every(r=>!r.target.startsWith(r.lens+"."))).toBe(true);
  expect(events.at(-1)?.type).toBe("done");expect(d.sourceHash).toMatch(/^[0-9a-f]{64}$/);
 });
 it("is deterministic for the fixture provider and runs agents concurrently",async()=>{
  const a=await runDiscussion({problem:sample.problem,lenses:sample.lenses},fixtureProvider());
  const b=await runDiscussion({problem:sample.problem,lenses:sample.lenses},fixtureProvider());
  expect(a.sourceHash).toBe(b.sourceHash);expect(a.synthesis).toEqual(b.synthesis);
  const started=performance.now();await runDiscussion({problem:sample.problem,lenses:["discovery","field-debug","validation"]},fixtureProvider({simulateLatency:true}));
  // Sequential would be ≥ (700+1100+800)×2 ms; parallel is bounded by the slowest lens per round.
  expect(performance.now()-started).toBeLessThan(3500);
 },10000);
 it("records slow, failing and contract-violating agents instead of dropping them",async()=>{
  const base=fixtureProvider();
  const provider:AgentProvider={id:"test",mode:"fixture",agent(lens){const a=base.agent(lens);
   if(lens.id==="cost") return {...a,explore:()=>new Promise(()=>{})} as LensAgent;
   if(lens.id==="security") return {...a,explore:async()=>{throw new Error("boom");}} as LensAgent;
   if(lens.id==="compat-scale") return {...a,explore:async(p,c)=>({...(await a.explore(p,c)),claims:[{id:"discovery.9",statement:"spoofed",kind:"observation",confidence:1,tags:["x1"]}]})} as LensAgent;
   if(lens.id==="validation") return {...a,review:async()=>[{target:"validation.1",stance:"support",note:"self"}]} as LensAgent;
   return a;}};
  const d=await runDiscussion({problem:sample.problem,lenses:sample.lenses},provider,{agentTimeoutMs:200});
  expect(d.failures).toEqual([{lens:"security",round:1,error:"agent_error"},{lens:"cost",round:1,error:"timeout"},{lens:"compat-scale",round:1,error:"invalid_output"},{lens:"validation",round:2,error:"invalid_output"}]);
  expect(d.synthesis.coverage).toMatchObject({requested:7,explored:4});
  expect(d.reviews.some(r=>r.lens==="validation")).toBe(false);
 });
 it("stops on cancellation",async()=>{const c=new AbortController();const p=runDiscussion({problem:sample.problem,lenses:sample.lenses},fixtureProvider({simulateLatency:true}),{signal:c.signal});setTimeout(()=>c.abort(),50);await expect(p).rejects.toThrow("cancelled");});
 it("validates the request shape",()=>{
  expect(()=>parseRequest({problem:sample.problem,lenses:["discovery"]})).toThrow("invalid_input");
  expect(()=>parseRequest({problem:sample.problem,lenses:["discovery","discovery"]})).toThrow("invalid_input");
  expect(()=>parseRequest({problem:sample.problem,lenses:["discovery","oracle"]})).toThrow("invalid_input");
  expect(()=>parseRequest({problem:{title:"x",statement:"short"},lenses:["discovery","cost"]})).toThrow("invalid_input");
 });
});

describe("deterministic synthesis",()=>{
 const t:Transcript={version:"1",problem:{title:"t",statement:"synthetic statement"},lenses:["field-debug","validation","security"],provider:{id:"test",mode:"fixture"},failures:[],
  positions:[
   {lens:"field-debug",skill:"fde-field-debug",summary:"s",claims:[{id:"field-debug.1",statement:"PM part",kind:"hypothesis",confidence:0.8,tags:["pm"]},{id:"field-debug.2",statement:"diff table",kind:"assumption",confidence:0.5,tags:["chamber-matching"]}],risks:["symptom suppression"],nextChecks:[{id:"field-debug.c1",action:"check PM log",cost:"low",resolves:["field-debug.1"]},{id:"field-debug.c2",action:"overlay traces",cost:"high",resolves:["field-debug.2"]}],questions:["When did it start?"],durationMs:1},
   {lens:"validation",skill:"fde-validation-review",summary:"s",claims:[{id:"validation.1",statement:"need control",kind:"assumption",confidence:0.7,tags:["sample-size"]}],risks:["Symptom  suppression"],nextChecks:[],questions:["when did it start?"],durationMs:1},
   {lens:"security",skill:"fde-security-review",summary:"s",claims:[{id:"security.1",statement:"no export",kind:"assumption",confidence:0.8,tags:["data-export"]}],risks:[],nextChecks:[{id:"security.c1",action:"ask security",cost:"low",resolves:["security.1"]}],questions:[],durationMs:1}],
  reviews:[{lens:"validation",target:"field-debug.1",stance:"challenge",note:"no counterexample"},{lens:"security",target:"field-debug.1",stance:"support",note:"ok"},{lens:"security",target:"validation.1",stance:"support",note:"ok"},{lens:"field-debug",target:"validation.1",stance:"refine",note:"stratify"}]};
 it("classifies claims, ranks checks and merges duplicates",()=>{
  const s=synthesize(t);
  expect(s.contested.map(c=>c.claim.id)).toEqual(["field-debug.1"]);
  expect(s.consensus.map(c=>c.claim.id)).toEqual(["validation.1"]);
  expect(s.singleSource.map(c=>c.claim.id)).toEqual(["security.1","field-debug.2"]);
  expect(s.agreement).toBe(0.5);
  expect(s.actions.map(a=>[a.id,a.priority])).toEqual([["field-debug.c1",5],["security.c1",3],["field-debug.c2",1]]);
  expect(s.questions).toEqual([{text:"When did it start?",lenses:["field-debug","validation"]}]);
  expect(s.risks[0].lenses).toEqual(["field-debug","validation"]);
  expect(s.coverage).toEqual({requested:3,explored:3,reviewed:3,failed:[]});
 });
 it("rejects transcripts with broken references, self-review or spoofed claim ids",()=>{
  const bad=(f:(x:Transcript)=>void)=>{const x=structuredClone(t);f(x);return ()=>assertTranscript(x);};
  expect(bad(()=>{})).not.toThrow();
  expect(bad(x=>x.reviews.push({lens:"field-debug",target:"field-debug.2",stance:"support",note:"me"}))).toThrow("invalid_transcript");
  expect(bad(x=>x.reviews.push({lens:"validation",target:"cost.1",stance:"support",note:"ghost"}))).toThrow("invalid_transcript");
  expect(bad(x=>x.reviews.push({lens:"validation",target:"field-debug.1",stance:"support",note:"twice"}))).toThrow("invalid_transcript");
  expect(bad(x=>{x.positions[1].claims[0].id="security.9";})).toThrow("invalid_transcript");
  expect(bad(x=>{x.positions[0].nextChecks[0].resolves=["security.1"];})).toThrow("invalid_transcript");
  expect(bad(x=>{(x as unknown as {synthesis:unknown}).synthesis={};})).toThrow("invalid_transcript");
 });
 it("re-synthesizes imported transcripts and marks provenance",()=>{const d=synthesizeTranscript({...t,provider:{id:"claude-code",mode:"live"}});expect(d.provider).toEqual({id:"claude-code",mode:"imported"});expect(d.synthesis.contested).toHaveLength(1);});
});

describe("discussion API",()=>{
 it("streams agent events as NDJSON and ends with the discussion",async()=>{
  process.env.DISCUSSION_LATENCY="off";
  const r=await POST(req({problem:sample.problem,lenses:["field-debug","validation","security"]}));
  expect(r.status).toBe(200);expect(r.headers.get("content-type")).toContain("application/x-ndjson");
  const events=await ndjson(r);expect(events[0].type).toBe("start");const done=events.at(-1);
  expect(done.type).toBe("done");expect(done.discussion.synthesis.headline).toContain("3개 관점");
 });
 it("imports a transcript and rejects unknown fields or bad lenses",async()=>{
  const d=await runDiscussion({problem:sample.problem,lenses:["discovery","validation"]},fixtureProvider());
  const {sourceHash:_h,synthesis:_s,...transcript}=d;
  const r=await POST(req({transcript}));expect(r.status).toBe(200);expect((await r.json()).provider.mode).toBe("imported");
  expect((await POST(req({transcript:{...transcript,synthesis:{}}}))).status).toBe(400);
  expect((await POST(req({problem:sample.problem,lenses:["discovery"]}))).status).toBe(400);
  expect((await POST(req({problem:sample.problem,lenses:["discovery","cost"],model:"x"}))).status).toBe(400);
 });
 it("requires run:create, so a viewer cannot start a discussion",async()=>{
  const r=await login(new Request(origin+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({email:"viewer@example.com",password:"demo-viewer-password"})}));
  const cookie=r.headers.get("set-cookie")!.split(";")[0];
  const res=await POST(req({problem:sample.problem,lenses:["discovery","cost"]},{cookie}));expect(res.status).toBe(403);
 });
 it("refuses live mode without a registered provider",async()=>{
  const prev={mode:process.env.APP_MODE,token:process.env.SERVICE_TOKEN,tenant:process.env.SERVICE_TENANT};
  Object.assign(process.env,{APP_MODE:"live",SERVICE_TOKEN:"t".repeat(40),SERVICE_TENANT:"acme"});
  try{const res=await POST(req({problem:sample.problem,lenses:["discovery","cost"]},{authorization:"Bearer "+"t".repeat(40)}));expect(res.status).toBe(409);expect((await res.json()).error).toBe("provider_unavailable");}
  finally{for(const [k,v] of [["APP_MODE",prev.mode],["SERVICE_TOKEN",prev.token],["SERVICE_TENANT",prev.tenant]] as const){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 });
});
