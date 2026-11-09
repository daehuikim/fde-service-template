import {describe,it,expect} from "vitest";
import {runDiscussion,synthesizeTranscript,parseRequest,type AgentProvider,type DiscussionEvent,type LensAgent} from "../packages/agents";
import {fixtureProvider} from "../packages/agents/fixture";
import {samples} from "../packages/agents/samples";
import {synthesize} from "../packages/domain/discussion";
import {assertTranscript,type Transcript} from "../packages/contracts/discussion";
import {POST} from "../apps/web/app/api/discussions/route";
import {renderReport} from "../packages/domain/report";
import {structuralAudit} from "../packages/domain/verification";
import {comprehensionGoldfish,zoomOutGoldfish,type GoldfishReviewer} from "../packages/agents/goldfish";
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
 it("re-synthesizes imported transcripts and marks provenance",async()=>{const d=await synthesizeTranscript({...t,provider:{id:"claude-code",mode:"live"}});expect(d.provider).toEqual({id:"claude-code",mode:"imported"});expect(d.synthesis.contested).toHaveLength(1);});
});

describe("elephant-goldfish verification (round 3)",()=>{
 it("runs after synthesis and reports every reviewer with a verdict",async()=>{
  const events:DiscussionEvent[]=[];
  const d=await runDiscussion({problem:sample.problem,lenses:sample.lenses},fixtureProvider(),{onEvent:e=>events.push(e)});
  const lastReview=events.map((e,i)=>e.type==="agent"&&e.round===2?i:-1).reduce((a,b)=>Math.max(a,b));
  expect(events.findIndex(e=>e.type==="goldfish")).toBeGreaterThan(lastReview);
  expect(d.verification.reviewers.map(r=>[r.reviewer,r.status])).toEqual([["structural","completed"],["comprehension","completed"],["zoom-out","completed"]]);
  expect(d.verification.documentHash).toMatch(/^[0-9a-f]{64}$/);
  // etch sample: the problem says 폐쇄망 but target-env was not chosen; one contested claim has no deciding check.
  expect(d.verification.findings.some(f=>f.reviewer==="zoom-out"&&f.finding.includes("target-env"))).toBe(true);
  expect(d.verification.verdict).toBe("attention");
 });
 it("gives goldfish only the rendered report and the problem, never the transcript",async()=>{
  let seen:unknown;
  const spy:GoldfishReviewer={id:"spy",title:"spy",focus:"spy",async review(p){seen=p;return [];}};
  const d=await runDiscussion({problem:sample.problem,lenses:["discovery","validation"]},fixtureProvider(),{goldfish:[spy]});
  expect(Object.keys(seen as object).sort()).toEqual(["document","problem"]);
  const {verification:_v,...base}=d;
  expect((seen as {document:string}).document).toBe(renderReport(base));
 });
 it("retries a failing goldfish once and marks it not_run instead of 'no findings'",async()=>{
  let calls=0;const flaky:GoldfishReviewer={id:"flaky",title:"f",focus:"f",async review(){calls++;throw new Error("down");}};
  let calls2=0;const second:GoldfishReviewer={id:"second-try",title:"s",focus:"s",async review(){calls2++;if(calls2===1)return [{severity:"bogus"}] as never;return [{severity:"nit",scope:"x",finding:"ok finding",recommendation:"ok"}];}};
  const d=await runDiscussion({problem:sample.problem,lenses:["discovery","validation"]},fixtureProvider(),{goldfish:[flaky,second]});
  expect(calls).toBe(2);
  expect(d.verification.reviewers.find(r=>r.reviewer==="flaky")).toMatchObject({status:"not_run",attempts:2,findings:0});
  expect(d.verification.reviewers.find(r=>r.reviewer==="second-try")).toMatchObject({status:"completed",attempts:2,findings:1});
  expect(["incomplete","blocked"]).toContain(d.verification.verdict);
 });
 it("structural audit flags failures, undecidable disputes, unsupported observations and silent lenses",async()=>{
  const d=await runDiscussion({problem:sample.problem,lenses:["discovery","field-debug"]},fixtureProvider());
  const {verification:_v,...base}=d;const x=structuredClone(base);
  x.failures=[{lens:"discovery",round:2,error:"timeout"}];
  x.positions[1].claims[0]={...x.positions[1].claims[0],kind:"observation",evidence:undefined};delete x.positions[1].claims[0].evidence;
  x.synthesis.contested=[{claim:x.positions[1].claims[0],author:"field-debug",status:"contested",supporters:[],challenges:[{lens:"discovery",note:"n"}],refinements:[],weight:0}];
  x.positions[1].nextChecks=[];x.reviews=[];
  const f=structuralAudit(x);
  expect(f.some(i=>i.scope==="discovery · 2라운드"&&i.severity==="major")).toBe(true);
  expect(f.some(i=>i.scope===x.positions[1].claims[0].id&&i.finding.includes("판별할 확인"))).toBe(true);
  expect(f.some(i=>i.finding.includes("관측(observation)"))).toBe(true);
  expect(f.some(i=>i.scope==="field-debug"&&i.finding.includes("의견을 하나도"))).toBe(true);
  x.positions=x.positions.slice(0,1);expect(structuralAudit(x).some(i=>i.severity==="blocker")).toBe(true);
 });
 it("comprehension goldfish: unparaphrasable report is a blocker; undefined acronyms are flagged",async()=>{
  const problem={title:"t",statement:"synthetic statement"};
  expect((await comprehensionGoldfish.review({problem,document:"# x\n\n## 한 줄 결론\n\n결론\n\n## 우선 확인할 일\n\n- 없음\n"},new AbortController().signal))[0].severity).toBe("blocker");
  const r=await comprehensionGoldfish.review({problem,document:"# x\n\n## 한 줄 결론\n\nQZX와 PM 확인\n\n## 우선 확인할 일\n\n1. `a.c1` 확인 (판별 대상 `a.1`)\n\n## 쟁점\n\n- `a.1` s\n"},new AbortController().signal);
  expect(r.map(f=>f.finding).join()).toContain("QZX");expect(r.map(f=>f.finding).join()).not.toContain("PM");
  expect((await zoomOutGoldfish.review({problem:{title:"t",statement:"폐쇄망 ML 가상 계측"},document:"관점: discovery, field-debug\n"},new AbortController().signal)).map(f=>f.finding).join()).toMatch(/security[\s\S]*target-env[\s\S]*validation/);
 });
 it("merges host-run goldfish findings from an imported transcript and rejects malformed ones",async()=>{
  const d=await runDiscussion({problem:sample.problem,lenses:["discovery","validation"]},fixtureProvider());
  const {sourceHash:_h,synthesis:_s,verification:_v,...t}=d;
  const host={reviewers:[{reviewer:"design-critic",status:"completed" as const,findings:[{severity:"blocker" as const,scope:"discovery.1",finding:"The baseline claim cannot be tested as written.",recommendation:"Name the observation that would falsify it."}]},{reviewer:"structural",status:"not_run" as const,findings:[]}]};
  const v=(await synthesizeTranscript({...t,verification:host})).verification;
  expect(v.verdict).toBe("blocked");expect(v.findings[0].id).toBe("design-critic.f1");
  expect(v.reviewers.find(r=>r.reviewer==="host-structural")).toMatchObject({source:"host",status:"not_run"});
  await expect(synthesizeTranscript({...t,verification:{reviewers:[{reviewer:"x1x",status:"completed",findings:[{severity:"fatal",scope:"a",finding:"b",recommendation:"c"}]}]}})).rejects.toThrow("invalid_transcript");
 });
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
  const {sourceHash:_h,synthesis:_s,verification:_v,...transcript}=d;
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
