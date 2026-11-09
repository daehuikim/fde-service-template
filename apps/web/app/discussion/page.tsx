"use client";
// Multi-agent discussion viewer. The discussion itself (parallel exploration, cross-review, synthesis and goldfish
// verification) runs in a host assistant through the fde-multi-agent-review skill. This page imports that record,
// lets the API check its contract and report hash, and shows it. Nothing on this page or in the API judges content.
import {useMemo,useState} from "react";
import {Button} from "../../components/ui/button";
import {Sidebar} from "../../components/sidebar";
import {lensCatalog,goldfishCatalog} from "../../../../packages/agents/lenses";
import example from "../../../../packages/agents/examples/cvd-particle.discussion.json";
import type {Discussion,LensId,ClaimKind,Failure,Severity,Verdict} from "../../../../packages/contracts/discussion";
import {claimViews,actionViews,type ClaimView} from "../../../../packages/domain/discussion";
import {renderReport} from "../../../../packages/domain/report";

type Phase="idle"|"checking"|"done"|"error";
type View="summary"|"verify"|"matrix"|"positions";
const lensColor:Record<LensId,string>={"discovery":"#3b6ea8","field-debug":"#b5542c","problem-design":"#6b4fb3","validation":"#0f7b6c","security":"#a3364f","target-env":"#4c617a","cost":"#9a6b0c","compat-scale":"#2f7d32"};
const kindLabel:Record<ClaimKind,string>={observation:"관측",hypothesis:"가설",assumption:"가정",vendor_claim:"업체 주장"};
const costLabel={low:"비용 낮음",medium:"비용 중간",high:"비용 높음"} as const;
const errorLabel:Record<Failure["error"],string>={timeout:"시간 초과",agent_error:"에이전트 오류",invalid_output:"계약 위반 출력",cancelled:"취소"};
const statusLabel={consensus:"합의",contested:"쟁점",single_source:"단일 관점"} as const;
const messages:Record<string,string>={
 forbidden:"이 계정에는 토론 기록 가져오기 권한(run:create)이 없습니다. 권한이 있는 계정으로 로그인하세요.",
 unauthorized:"로그인이 만료되었습니다. 다시 로그인해 주세요.",
 invalid_input:"요청 형식이 맞지 않습니다. 토론 기록 JSON만 붙여 넣으세요.",
 invalid_transcript:"기록이 계약(discussion.schema.json)과 맞지 않습니다. pnpm discussion check로 어느 항목이 틀렸는지 먼저 확인하세요.",
 stale_verification:"goldfish가 검토한 보고서와 지금 기록이 다릅니다. 검토 뒤에 기록이 바뀌었으니 pnpm discussion report로 보고서를 다시 만들고 goldfish 검증을 다시 실행하세요.",
 input_too_large:"기록이 너무 큽니다(최대 약 200 KB).",
};
const verdictLabel:Record<Verdict,string>={pass:"검증 통과",attention:"확인 필요",blocked:"보고서 결함",incomplete:"검증 미완료"};
const verdictHelp:Record<Verdict,string>={pass:"맥락 없는 검토자가 주요 문제를 찾지 못했습니다.",attention:"결론을 쓰기 전에 주요 지적을 확인하세요.",blocked:"이 보고서로 결정하면 안 되는 결함이 있습니다.",incomplete:"일부 검토자가 실행되지 않았습니다. 지적이 없는 것과 다릅니다."};
const severityLabel:Record<Severity,string>={blocker:"차단",major:"주요",nit:"사소"};
const reviewerTitle=(id:string)=>goldfishCatalog[id]?.title??id;
const reviewerFocus=(id:string)=>goldfishCatalog[id]?.focus??"skill에서 추가한 goldfish 검토자";
const say=(code:string)=>messages[code]??"기록을 가져오지 못했습니다. 입력을 확인하고 다시 시도해 주세요.";
const pct=(n:number)=>Math.round(n*100)+"%";
const secs=(ms?:number)=>ms===undefined?"":(ms/1000).toFixed(1)+"s";

function LensTag({lens}:{lens:LensId}){return <span className="lens-tag" style={{"--lens":lensColor[lens]} as React.CSSProperties}>{lensCatalog[lens].title}</span>;}

export default function DiscussionPage(){
 const [phase,setPhase]=useState<Phase>("idle"),[message,setMessage]=useState("skill로 만든 토론 기록을 가져오거나 예제 기록을 불러오세요.");
 const [discussion,setDiscussion]=useState<Discussion|null>(null),[view,setView]=useState<View>("summary");
 const [text,setText]=useState(""),[showAll,setShowAll]=useState(false);
 const [decisions,setDecisions]=useState<Record<string,"accept"|"defer">>({}),[registered,setRegistered]=useState<Record<string,"saving"|"saved"|"failed">>({});
 const busy=phase==="checking";

 async function importRecord(raw:string){
  setPhase("checking");setDiscussion(null);setDecisions({});setRegistered({});setMessage("기록의 계약, 참조, 보고서 해시를 확인하고 있습니다.");
  try{let record:unknown;try{record=JSON.parse(raw);}catch{throw new Error("invalid_transcript");}
   const res=await fetch("/api/discussions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({record})});
   const d=await res.json().catch(()=>({}));if(!res.ok)throw new Error(d.error);
   setDiscussion(d);setShowAll(false);setView("summary");setPhase("done");setMessage(d.synthesis.headline);
   requestAnimationFrame(()=>document.querySelector(".synthesis")?.scrollIntoView({behavior:"smooth",block:"start"}));
  }catch(e){setPhase("error");setMessage(say(e instanceof Error?e.message:"tool_failure"));}
 }
 function loadExample(){const t=JSON.stringify(example,null,2);setText(t);void importRecord(t);}

 async function register(id:string,title:string,rank:number){
  setRegistered(r=>({...r,[id]:"saving"}));
  try{const res=await fetch("/api/work-items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:"discussions",title:title.slice(0,200),priority:rank<2?1:rank<4?2:3})});
   if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error);}setRegistered(r=>({...r,[id]:"saved"}));}
  catch(e){setRegistered(r=>({...r,[id]:"failed"}));setMessage(say(e instanceof Error?e.message:"tool_failure"));}
 }
 function save(body:string,type:string,name:string){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
 // Human decisions on goldfish findings travel with the export; they never change the verdict, which stays the reviewers'.
 function download(){if(!discussion)return;save(JSON.stringify({...discussion,humanDecisions:decisions},null,2),"application/json",`discussion-${discussion.sourceHash.slice(0,8)}.json`);}
 function downloadReport(){if(!discussion)return;const {verification:_v,sourceHash:_s,...base}=discussion;save(renderReport(base),"text/markdown",`discussion-${discussion.sourceHash.slice(0,8)}.md`);}

 const claims=useMemo(()=>discussion?claimViews(discussion):[],[discussion]);
 const actions=useMemo(()=>discussion?actionViews(discussion):[],[discussion]);
 const by=(s:ClaimView["status"])=>claims.filter(c=>c.status===s);
 const contested=by("contested"),consensus=by("consensus"),single=by("single_source");
 const v=discussion?.verification,s=discussion?.synthesis;
 const findings=v?v.reviewers.flatMap(r=>r.findings.map((f,i)=>({...f,key:`${r.reviewer}.${i+1}`,reviewer:r.reviewer}))):[];
 const reviewedBy=discussion?new Set(discussion.reviews.map(r=>r.lens)):new Set<LensId>();

 return <><Sidebar active="discussion"/><main><header><span>워크스페이스 / 멀티 에이전트 토론</span><span className="badge">● SKILL RECORD</span></header>
 <section className="intro"><p className="eyebrow">FIELD PROBLEM / MULTI-AGENT DISCUSSION</p><h1>한 문제를 여러 관점이 동시에.<br/><span>판단은 skill이, 확인은 앱이 합니다.</span></h1><p>반도체 현장 문제 하나를 Claude Code·Codex에서 <code>fde-multi-agent-review</code> skill로 실행합니다.<br/>관점별 에이전트가 병렬로 탐색하고 서로 교차 검토한 뒤, 종합 에이전트가 합의·쟁점·우선 확인을 정리하고,<br/>토론 맥락이 없는 goldfish 에이전트가 그 보고서를 검증합니다. 이 화면은 그 기록을 확인하고 보여 줍니다.</p></section>
 <div className="steps"><b>01　독립 탐색 · 병렬</b><span>→</span><b>02　교차 검토 · 병렬</b><span>→</span><b>03　종합 에이전트</b><span>→</span><b>04　Goldfish 검증</b><span>→</span><b>05　기록 확인 · 공유</b></div>

 <div className="workspace discuss-setup">
  <section className="panel"><div className="panel-head"><div><p className="eyebrow">RUN IN YOUR ASSISTANT</p><h2>skill로 토론 실행</h2></div></div>
   <ol className="compact run-steps">
    <li><p>Claude Code나 Codex에서 문제를 설명하고 <code>fde-multi-agent-review</code> skill을 실행합니다.</p><small>관점마다 해당 skill을 가진 하위 에이전트가 같은 문제 패킷만 받고 동시에 탐색합니다.</small></li>
    <li><p>교차 검토와 종합까지 skill이 진행해 토론 기록 JSON을 만듭니다.</p><small>합의·쟁점 분류, 확인 순위와 이유는 종합 에이전트가 씁니다.</small></li>
    <li><p><code>pnpm discussion report 기록.json</code>으로 보고서를 만들어 goldfish 에이전트에게 넘깁니다.</p><small>goldfish는 보고서와 문제만 읽습니다. 결과와 보고서 해시를 기록에 넣습니다.</small></li>
    <li><p><code>pnpm discussion check 기록.json</code>을 통과한 기록을 아래에 가져옵니다.</p></li>
   </ol>
   <div className="lens-grid">{(Object.keys(lensCatalog) as LensId[]).map(l=><div key={l} className="lens-option on" style={{"--lens":lensColor[l]} as React.CSSProperties}><b>{lensCatalog[l].title}</b><small>{lensCatalog[l].question}</small><code>{lensCatalog[l].skill}</code></div>)}</div>
  </section>
  <section className="panel"><div className="panel-head"><div><p className="eyebrow">IMPORT RECORD</p><h2>토론 기록 가져오기</h2></div></div>
   <p className="hint">앱은 계약, 주장·검토·확인 id의 참조, goldfish가 이 보고서를 검토했는지(보고서 해시)만 확인합니다. 내용을 고치거나 다시 분류하지 않습니다. 고객 원본 로그·레시피·장비 식별자는 기록에 넣지 마세요.</p>
   <textarea className="short mono" aria-label="토론 기록 JSON" spellCheck={false} value={text} disabled={busy} onChange={e=>setText(e.target.value)} placeholder='{"version":"2","problem":{…},"lenses":[…],"positions":[…],"reviews":[…],"failures":[],"synthesis":{…},"verification":{…}}'/>
   <div className="actions"><Button className="primary" disabled={busy||!text.trim()} onClick={()=>importRecord(text)}>{busy?"확인 중…":"확인 후 보기"}</Button>
    <label className="file">JSON 파일 선택<input type="file" accept="application/json,.json" disabled={busy} onChange={async e=>{const f=e.target.files?.[0];if(f){const t=await f.text();setText(t);await importRecord(t);}e.target.value="";}}/></label>
    <Button disabled={busy} onClick={loadExample}>예제 기록 불러오기</Button></div>
  </section>
 </div>

 <p role="status" aria-live="polite" className={"status discuss-status "+(phase==="checking"?"running":phase)}>{message}</p>

 {discussion&&s&&v&&<>
  <section className="panel lanes" aria-label="실행 기록"><div className="panel-head"><div><p className="eyebrow">RUN RECORD</p><h2>관점별 실행</h2></div><span className="provider">{discussion.runner.host}{discussion.runner.model?` · ${discussion.runner.model}`:""}</span></div>
   {discussion.lenses.map(l=>{const p=discussion.positions.find(x=>x.lens===l),f1=discussion.failures.find(x=>x.lens===l&&x.round===1),f2=discussion.failures.find(x=>x.lens===l&&x.round===2);const n=discussion.reviews.filter(r=>r.lens===l).length;
    return <div className="lane" key={l} style={{"--lens":lensColor[l]} as React.CSSProperties}><div className="lane-name"><i/><b>{lensCatalog[l].title}</b><code>{lensCatalog[l].skill}</code></div>
     <div className={"pill "+(p?"done":"failed")}>1 독립 탐색 · {p?<>완료 · 주장 {p.claims.length}{p.durationMs?<> · {secs(p.durationMs)}</>:null}</>:<>실패{f1&&<> · {errorLabel[f1.error]}</>}</>}</div>
     <div className={"pill "+(f2?"failed":!p?"skipped":reviewedBy.has(l)?"done":"skipped")}>2 교차 검토 · {f2?<>실패 · {errorLabel[f2.error]}</>:!p?"건너뜀":n?`의견 ${n}`:"의견 없음"}</div></div>;})}
   <div className="fish-row"><span className="fish-label">3 Goldfish 검증</span>{v.reviewers.map(r=><div key={r.reviewer} className={"pill "+(r.status==="completed"?"done":"failed")}>{reviewerTitle(r.reviewer)} · {r.status==="completed"?`완료 · 지적 ${r.findings.length}`:"미실행"}</div>)}</div>
  </section>

  <section className="panel synthesis"><p className="eyebrow">SYNTHESIS</p><h2>{discussion.problem.title}</h2>
   <button type="button" className={"verdict "+v.verdict} onClick={()=>setView("verify")}><b>{verdictLabel[v.verdict]}</b><span>{verdictHelp[v.verdict]}</span><small>{(["blocker","major","nit"] as Severity[]).map(k=>`${severityLabel[k]} ${findings.filter(f=>f.severity===k).length}`).join(" · ")} · 검증 결과 보기 →</small></button><p className="headline">{s.headline}</p>
   <div className="metrics four"><div><strong>{consensus.length}</strong>합의</div><div><strong>{contested.length}</strong>쟁점</div><div><strong>{single.length}</strong>단일 관점</div><div><strong>{actions.length}</strong>우선 확인</div></div>
   <p className="hint">탐색 {discussion.positions.length}/{discussion.lenses.length} · 교차 검토 참여 {reviewedBy.size} · 실패 {discussion.failures.length?discussion.failures.map(f=>`${lensCatalog[f.lens].title}(${f.round}차, ${errorLabel[f.error]})`).join(", "):"없음"} · 기록 SHA-256 {discussion.sourceHash.slice(0,12)}<br/>분류·순위·이유는 skill의 종합 에이전트가 쓴 것입니다. 모든 줄은 주장 id와 관점으로 원문에 연결됩니다.</p>
   <div className="tabs" role="tablist">{([["summary","종합"],["verify",`Goldfish 검증 ${findings.length}`],["matrix","토론 매트릭스"],["positions","관점별 원문"]] as [View,string][]).map(([k,t])=><button key={k} role="tab" aria-selected={view===k} className={view===k?"on":""} onClick={()=>setView(k)}>{t}</button>)}<span className="grow"/><Button onClick={downloadReport}>보고서 Markdown ↓</Button><Button onClick={download}>토론 JSON 내보내기 ↓</Button></div>
  </section>

  {view==="summary"&&<div className="workspace summary-grid">
   <section className="panel"><p className="eyebrow">NEXT CHECKS</p><h2>우선 확인할 일</h2><p className="hint">순서와 이유는 종합 에이전트가 정했습니다.</p>
    <ol className="actions-list">{actions.map(a=><li key={a.id}><span className="rank">{a.rank}</span><div><p>{a.action}</p><div className="meta"><LensTag lens={a.lens}/><span className={"cost "+a.cost}>{costLabel[a.cost]}</span><span>{a.rationale}</span>{a.resolves.map(r=><code key={r}>{r}</code>)}</div>
     <button type="button" className="link" disabled={registered[a.id]==="saving"||registered[a.id]==="saved"} onClick={()=>register(a.id,`[${lensCatalog[a.lens].title}] ${a.action}`,a.rank-1)}>{registered[a.id]==="saved"?"작업으로 등록됨 ✓":registered[a.id]==="saving"?"등록 중…":registered[a.id]==="failed"?"다시 등록":"작업으로 등록 +"}</button></div></li>)}</ol>
    {!actions.length&&<p className="hint">제안된 확인 항목이 없습니다.</p>}
   </section>
   <section className="panel"><p className="eyebrow">CONTESTED</p><h2>쟁점 <small className="count">{contested.length}</small></h2>
    {contested.length?contested.map(c=><ClaimCard key={c.claim.id} c={c}/>):<p className="hint">쟁점으로 분류된 주장이 없습니다. 합의가 근거 없이 나온 것은 아닌지 단일 관점 항목을 확인하세요.</p>}
    <p className="eyebrow gap">CONSENSUS</p><h2>합의 <small className="count">{consensus.length}</small></h2>
    <ul className="compact">{(showAll?consensus:consensus.slice(0,6)).map(c=><li key={c.claim.id}><ClaimHead c={c}/><p>{c.claim.statement}</p><small>지지: {c.supporters.map(r=>lensCatalog[r.lens].title).join(", ")||"없음"}{c.refinements.length>0&&` · 보완 의견 ${c.refinements.length}`}{c.note&&` · ${c.note}`}</small></li>)}</ul>{consensus.length>6&&<button type="button" className="link" aria-expanded={showAll} onClick={()=>setShowAll(x=>!x)}>{showAll?"접기":`합의 ${consensus.length-6}건 더 보기`}</button>}
    <p className="eyebrow gap">SINGLE SOURCE</p><h2>단일 관점 <small className="count">{single.length}</small></h2>
    <ul className="compact">{single.map(c=><li key={c.claim.id}><ClaimHead c={c}/><p>{c.claim.statement}</p><small>작성: {lensCatalog[c.author].title}{c.note&&` · ${c.note}`}</small></li>)}</ul>
    {s.questions.length>0&&<><p className="eyebrow gap">OPEN QUESTIONS</p><ul className="compact">{s.questions.map(q=><li key={q}><p>{q}</p></li>)}</ul></>}
    {s.risks.length>0&&<><p className="eyebrow gap">RISKS</p><ul className="compact">{s.risks.map(q=><li key={q}><p>{q}</p></li>)}</ul></>}
   </section>
  </div>}

  {view==="matrix"&&<section className="panel matrix-panel"><p className="eyebrow">STANCE MATRIX</p><h2>누가 무엇에 동의하고 반대했나</h2><p className="hint">● 작성 · ✓ 지지 · ✕ 반대 · △ 보완 · 셀에 마우스를 올리면 의견이 보입니다.</p>
   <div className="matrix-scroll"><table className="matrix"><thead><tr><th scope="col">주장</th>{discussion.lenses.map(l=><th scope="col" key={l} style={{"--lens":lensColor[l]} as React.CSSProperties}><span>{lensCatalog[l].title}</span></th>)}</tr></thead>
    <tbody>{[...contested,...consensus,...single].map(c=><tr key={c.claim.id} className={c.status}><th scope="row"><ClaimHead c={c}/><span className="stmt">{c.claim.statement}</span></th>{discussion.lenses.map(l=>{const r=discussion.reviews.find(x=>x.lens===l&&x.target===c.claim.id);const mark=c.author===l?"●":r?.stance==="support"?"✓":r?.stance==="challenge"?"✕":r?.stance==="refine"?"△":"";return <td key={l} className={r?.stance??(c.author===l?"author":"")} title={c.author===l?"작성한 관점":r?.note}>{mark}<span className="sr-only">{c.author===l?"작성":r?`${r.stance}: ${r.note}`:"의견 없음"}</span></td>;})}</tr>)}</tbody></table></div>
  </section>}

  {view==="verify"&&<section className="panel verify-panel"><p className="eyebrow">ELEPHANT · GOLDFISH</p><h2>맥락 없는 검토자가 본 보고서</h2>
   <p className="hint">토론을 진행한 오케스트레이터(elephant)는 모든 맥락을 갖고 있어 자기 보고서의 빈틈을 놓치기 쉽습니다. Goldfish 에이전트는 토론 기록 없이 <b>보고서와 문제만</b> 읽고 지적합니다. 실패한 검토자는 "지적 없음"이 아니라 "미실행"으로 남습니다. 어떤 지적을 반영할지는 사람이 정합니다. · 검토한 보고서 SHA-256 {v.reportHash.slice(0,12)}</p>
   <div className="reviewer-grid">{v.reviewers.map(r=><div key={r.reviewer} className={"reviewer "+r.status}><b>{reviewerTitle(r.reviewer)}</b><code>{r.reviewer}</code><small>{reviewerFocus(r.reviewer)}</small><span>{r.status==="completed"?`완료 · 지적 ${r.findings.length}`:"미실행"}{r.attempts>1?` · ${r.attempts}회 시도`:""}</span></div>)}</div>
   {findings.length?<ul className="findings">{findings.map(f=><li key={f.key} className={"finding "+f.severity+(decisions[f.key]?" decided-"+decisions[f.key]:"")}><div className="claim-head"><span className={"sev "+f.severity}>{severityLabel[f.severity]}</span><code>{reviewerTitle(f.reviewer)}</code><span className="conf">범위 {f.scope}</span></div><p>{f.finding}</p><small>권고: {f.recommendation}</small>
    <div className="decide" role="group" aria-label={`${f.key} 처리`}>{(["accept","defer"] as const).map(k=><button key={k} type="button" className={"link"+(decisions[f.key]===k?" on":"")} aria-pressed={decisions[f.key]===k} onClick={()=>setDecisions(d=>{const n={...d};if(n[f.key]===k)delete n[f.key];else n[f.key]=k;return n;})}>{k==="accept"?"반영하기":"근거 있어 보류"}</button>)}</div></li>)}</ul>:<p className="hint">지적이 없습니다. 지적이 없다는 것이 결론이 옳다는 뜻은 아닙니다.</p>}
  </section>}

  {view==="positions"&&<div className="positions">{discussion.positions.map(p=><section key={p.lens} className="panel position" style={{"--lens":lensColor[p.lens]} as React.CSSProperties}><p className="eyebrow">{p.skill}{p.durationMs?` · ${secs(p.durationMs)}`:""}</p><h2>{lensCatalog[p.lens].title}</h2><p className="summary">{p.summary}</p>
   <ul className="compact">{p.claims.map(c=><li key={c.id}><span className="claim-head"><code>{c.id}</code><span className={"kind "+c.kind}>{kindLabel[c.kind]}</span><span className="conf">확신 {pct(c.confidence)}</span></span><p>{c.statement}</p>{c.evidence&&<small>근거: {c.evidence}</small>}</li>)}</ul>
   {p.nextChecks.length>0&&<><p className="eyebrow gap">다음 확인</p><ul className="compact">{p.nextChecks.map(n=><li key={n.id}><p>{n.action}</p><small>{costLabel[n.cost]} · {n.resolves.join(", ")}</small></li>)}</ul></>}
  </section>)}{discussion.failures.filter(f=>f.round===1).map(f=><section key={f.lens} className="panel position failed" style={{"--lens":lensColor[f.lens]} as React.CSSProperties}><p className="eyebrow">{lensCatalog[f.lens].skill}</p><h2>{lensCatalog[f.lens].title}</h2><p className="summary">이 관점은 결과를 내지 못했습니다({errorLabel[f.error]}). 종합에서 빠진 관점으로 표시됩니다.</p></section>)}</div>}
 </>}
 {!discussion&&phase!=="checking"&&<div className="panel empty discuss-empty"><span>◎</span><h3>아직 가져온 토론 기록이 없습니다</h3><p>skill로 만든 기록을 붙여 넣거나 예제 기록을 불러오면<br/>합의·쟁점·우선 확인 항목과 goldfish 검증 결과를 볼 수 있습니다.</p></div>}
 <footer>FDE SERVICE TEMPLATE <span>skill 병렬 탐색 · 교차 검토 · goldfish 검증</span></footer></main></>;
}

function ClaimHead({c}:{c:ClaimView}){return <span className="claim-head"><code>{c.claim.id}</code><span className={"status-pill "+c.status}>{statusLabel[c.status]}</span><span className={"kind "+c.claim.kind}>{kindLabel[c.claim.kind]}</span><span className="conf">확신 {pct(c.claim.confidence)}</span></span>;}
function ClaimCard({c}:{c:ClaimView}){return <article className="claim-card"><ClaimHead c={c}/><p className="stmt">{c.claim.statement}</p>{c.note&&<p className="hint">종합 메모: {c.note}</p>}<div className="meta"><span>작성</span><LensTag lens={c.author}/>{c.supporters.length>0&&<><span>지지</span>{c.supporters.map(r=><LensTag key={r.lens} lens={r.lens}/>)}</>}</div>
 <ul className="remarks">{c.challenges.map(r=><li key={r.lens} className="challenge"><b>✕ {lensCatalog[r.lens].title}</b> {r.note}</li>)}{c.refinements.map(r=><li key={r.lens} className="refine"><b>△ {lensCatalog[r.lens].title}</b> {r.note}</li>)}</ul></article>;}
