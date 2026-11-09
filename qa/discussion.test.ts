import {describe,it,expect} from "vitest";
import {execFileSync} from "node:child_process";
import {mkdtempSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import example from "../packages/agents/examples/cvd-particle.discussion.json";
import {assertTranscript,type Transcript} from "../packages/contracts/discussion";
import {acceptDiscussion,reportHash} from "../packages/agents/record";
import {claimViews,actionViews} from "../packages/domain/discussion";
import {renderReport} from "../packages/domain/report";
import {POST} from "../apps/web/app/api/discussions/route";
import {POST as login} from "../apps/web/app/api/auth/login/route";

const origin="http://localhost";
const req=(body:unknown,headers:Record<string,string>={})=>new Request(origin+"/api/discussions",{method:"POST",headers:{"content-type":"application/json",origin,...headers},body:JSON.stringify(body)});
const fresh=()=>structuredClone(example) as Transcript;
// Re-pin the report hash after an edit so a test isolates the integrity rule it is about.
// A record with broken references cannot be rendered, so it keeps its old hash; the contract check fails first anyway.
function rehash(t:Transcript){const {verification,...base}=t;try{return {...t,verification:{...verification,reportHash:reportHash(base)}};}catch{return t;}}

describe("skill-produced discussion record",()=>{
 it("accepts the shipped example and pins its content",()=>{
  const d=acceptDiscussion(fresh());
  expect(d.sourceHash).toMatch(/^[0-9a-f]{64}$/);expect(acceptDiscussion(fresh()).sourceHash).toBe(d.sourceHash);
  expect(d.synthesis).toEqual(example.synthesis);expect(d.verification).toEqual(example.verification);
 });
 it("joins records without classifying: every status, rank and rationale comes from the synthesis",()=>{
  const t=fresh(),views=claimViews(t),actions=actionViews(t);
  expect(views.map(v=>[v.claim.id,v.status])).toEqual(t.synthesis.claims.map(c=>[c.id,c.status]));
  expect(actions.map(a=>[a.id,a.rank,a.rationale])).toEqual(t.synthesis.actions.map((a,i)=>[a.check,i+1,a.rationale]));
  const challenged=views.find(v=>v.challenges.length)!;expect(t.reviews.some(r=>r.target===challenged.claim.id&&r.stance==="challenge")).toBe(true);
 });
 it("rejects broken references and self-review",()=>{
  const bad=(f:(t:Transcript)=>void)=>{const t=fresh();f(t);return ()=>acceptDiscussion(rehash(t));};
  expect(bad(t=>{t.reviews[0]={...t.reviews[0],target:t.positions.find(p=>p.lens===t.reviews[0].lens)!.claims[0].id};})).toThrow("invalid_transcript");
  expect(bad(t=>{t.positions[1].claims[0].id="discovery.99";})).toThrow("invalid_transcript");
  expect(bad(t=>{t.synthesis.claims.pop();})).toThrow("invalid_transcript");
  expect(bad(t=>{t.synthesis.claims.push({...t.synthesis.claims[0]});})).toThrow("invalid_transcript");
  expect(bad(t=>{t.synthesis.actions[0].check="cost.c9";})).toThrow("invalid_transcript");
  expect(bad(t=>{t.positions[0].nextChecks[0].resolves=[t.positions[1].claims[0].id];})).toThrow("invalid_transcript");
  expect(bad(t=>{t.failures.push({lens:"cost",round:1,error:"timeout"});})).toThrow("invalid_transcript");
 });
 it("keeps not-run goldfish distinct from no findings and forbids a pass it cannot support",()=>{
  const nr=fresh().verification.reviewers.find(r=>r.status==="not_run")!;expect(nr.findings).toEqual([]);
  const withFindings=fresh();withFindings.verification.reviewers.find(r=>r.status==="not_run")!.findings=[{severity:"nit",scope:"x",finding:"y",recommendation:"z"}];
  expect(()=>assertTranscript(withFindings)).toThrow("invalid_transcript");
  const passNotRun=fresh();passNotRun.verification.verdict="pass";expect(()=>assertTranscript(passNotRun)).toThrow("invalid_transcript");
  const passBlocker=fresh();passBlocker.verification.reviewers=passBlocker.verification.reviewers.filter(r=>r.status==="completed");passBlocker.verification.reviewers[0].findings[0].severity="blocker";passBlocker.verification.verdict="pass";
  expect(()=>assertTranscript(passBlocker)).toThrow("invalid_transcript");
  const dup=fresh();dup.verification.reviewers.push({...dup.verification.reviewers[0]});expect(()=>assertTranscript(dup)).toThrow("invalid_transcript");
 });
 it("marks the verification stale when the record changes after goldfish review",()=>{
  const t=fresh();t.synthesis.headline+=" (수정)";expect(()=>acceptDiscussion(t)).toThrow("stale_verification");
  expect(()=>acceptDiscussion(rehash(t))).not.toThrow();
 });
 it("renders a deterministic report from the record's own content",()=>{
  const {verification:_v,...base}=fresh();const md=renderReport(base);
  expect(renderReport(base)).toBe(md);expect(md).toContain(base.synthesis.headline);
  for(const a of base.synthesis.actions)expect(md).toContain(a.rationale);
  expect(reportHash(base)).toBe(example.verification.reportHash);
 });
});

describe("discussion CLI",()=>{
 const cli=(...args:string[])=>execFileSync(process.execPath,["--import","tsx","packages/agents/cli.ts",...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
 it("prints the report goldfish read and checks a finished record",()=>{
  const dir=mkdtempSync(join(tmpdir(),"disc-")),file=join(dir,"r.json");writeFileSync(file,JSON.stringify(example));
  expect(cli("report",file)).toBe(renderReport((({verification:_v,...b})=>b)(fresh())));
  expect(cli("check",file)).toContain("verdict incomplete");
 },20000);
});

describe("discussion import API",()=>{
 it("accepts a record and rejects unknown fields, broken records and stale verification",async()=>{
  const r=await POST(req({record:example}));expect(r.status).toBe(200);expect((await r.json()).sourceHash).toMatch(/^[0-9a-f]{64}$/);
  expect((await POST(req({record:example,extra:1}))).status).toBe(400);
  expect((await POST(req({problem:example.problem,lenses:example.lenses}))).status).toBe(400);
  const broken=await POST(req({record:{...example,synthesis:{}}}));expect(broken.status).toBe(400);expect((await broken.json()).error).toBe("invalid_transcript");
  const stale=fresh();stale.synthesis.headline="다른 결론";
  const s=await POST(req({record:stale}));expect(s.status).toBe(409);expect((await s.json()).error).toBe("stale_verification");
 });
 it("requires run:create, so a viewer cannot import",async()=>{
  const r=await login(new Request(origin+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({email:"viewer@example.com",password:"demo-viewer-password"})}));
  const cookie=r.headers.get("set-cookie")!.split(";")[0];
  expect((await POST(req({record:example},{cookie}))).status).toBe(403);
 });
});
