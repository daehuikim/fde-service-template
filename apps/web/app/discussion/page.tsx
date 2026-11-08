"use client";
// Multi-agent discussion workspace: one field problem, several lens agents in parallel, a traceable synthesis.
// The server streams agent progress as NDJSON; every permission is still decided by the API.
import {useMemo,useRef,useState} from "react";
import {Button} from "../../components/ui/button";
import {Sidebar} from "../../components/sidebar";
import {lensCatalog,defaultLenses} from "../../../../packages/agents/lenses";
import {samples} from "../../../../packages/agents/samples";
import type {Discussion,LensId,Position,Problem,SynthesizedClaim,RankedAction,ClaimKind,Failure} from "../../../../packages/contracts/discussion";

type Step="waiting"|"running"|"done"|"failed"|"skipped";
interface Lane{r1:Step;r2:Step;ms1?:number;ms2?:number;claims?:number;reviews?:number;error?:Failure["error"]}
type Phase="idle"|"running"|"done"|"error";
type View="summary"|"matrix"|"positions";
const allLenses=Object.keys(lensCatalog) as LensId[];
const lensColor:Record<LensId,string>={"discovery":"#3b6ea8","field-debug":"#b5542c","problem-design":"#6b4fb3","validation":"#0f7b6c","security":"#a3364f","target-env":"#4c617a","cost":"#9a6b0c","compat-scale":"#2f7d32"};
const kindLabel:Record<ClaimKind,string>={observation:"관측",hypothesis:"가설",assumption:"가정",vendor_claim:"업체 주장"};
const costLabel={low:"비용 낮음",medium:"비용 중간",high:"비용 높음"} as const;
const errorLabel:Record<Failure["error"],string>={timeout:"시간 초과",agent_error:"에이전트 오류",invalid_output:"계약 위반 출력",cancelled:"취소"};
const stepLabel:Record<Step,string>={waiting:"대기",running:"진행 중",done:"완료",failed:"실패",skipped:"건너뜀"};
const messages:Record<string,string>={
 forbidden:"이 계정에는 토론 실행 권한(run:create)이 없습니다. 실행 권한이 있는 계정으로 로그인하세요.",
 unauthorized:"로그인이 만료되었습니다. 다시 로그인해 주세요.",
 invalid_input:"제목과 10자 이상의 문제 설명을 입력하고, 관점을 2개 이상 선택해 주세요.",
 invalid_transcript:"가져온 기록이 계약(discussion.schema.json)과 맞지 않습니다. 주장 id, 검토 대상, 관점 목록을 확인하세요.",
 provider_unavailable:"live 모드에 연결된 에이전트 공급자가 없습니다. 호스트에서 실행한 토론 기록을 가져와 종합하세요.",
 input_too_large:"입력이 너무 큽니다(최대 약 200 KB).",
 fixture_disabled_in_production:"운영 빌드에서는 합성 fixture 에이전트가 차단됩니다. 호스트에서 실행한 토론 기록을 가져와 종합하세요.",
 cancelled:"토론을 취소했습니다. 입력은 보존됩니다.",
};
const say=(code:string)=>messages[code]??"토론을 완료하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.";
const pct=(n:number)=>Math.round(n*100)+"%";
const secs=(ms?:number)=>ms===undefined?"":(ms/1000).toFixed(1)+"s";

function LensTag({lens}:{lens:LensId}){return <span className="lens-tag" style={{"--lens":lensColor[lens]} as React.CSSProperties}>{lensCatalog[lens].title}</span>;}

export default function DiscussionPage(){
 const [problem,setProblem]=useState<Problem>(samples[0].problem),[sample,setSample]=useState(samples[0].id);
 const [chosen,setChosen]=useState<LensId[]>(samples[0].lenses??defaultLenses);
 const [phase,setPhase]=useState<Phase>("idle"),[message,setMessage]=useState("예제 문제를 고르거나 직접 입력한 뒤 토론을 시작하세요.");
 const [lanes,setLanes]=useState<Partial<Record<LensId,Lane>>>({}),[positions,setPositions]=useState<Position[]>([]);
 const [discussion,setDiscussion]=useState<Discussion|null>(null),[view,setView]=useState<View>("summary");
 const [transcript,setTranscript]=useState(""),[showAll,setShowAll]=useState(false),[registered,setRegistered]=useState<Record<string,"saving"|"saved"|"failed">>({});
 const abort=useRef<AbortController|null>(null),finished=useRef(false);
 const busy=phase==="running";

 function choose(id:string){const s=samples.find(x=>x.id===id);if(!s)return;setSample(id);setProblem(s.problem);setChosen(s.lenses);reset();}
 function reset(){finished.current=false;setDiscussion(null);setPositions([]);setLanes({});setPhase("idle");setRegistered({});}
 function toggle(l:LensId){setChosen(c=>c.includes(l)?c.filter(x=>x!==l):allLenses.filter(x=>c.includes(x)||x===l));}
 function patch(l:LensId,p:Partial<Lane>){setLanes(s=>({...s,[l]:{...(s[l]??{r1:"waiting",r2:"waiting"}),...p}}));}

 function handle(e:any){
  if(e.type==="agent"){const r=e.round===1?"r1":"r2";const ms=e.round===1?"ms1":"ms2";
   if(e.state==="running") patch(e.lens,{[r]:"running"});
   else if(e.state==="done") patch(e.lens,{[r]:"done",[ms]:e.durationMs,...(e.round===1?{claims:e.count}:{reviews:e.count})});
   else patch(e.lens,{[r]:"failed",error:e.error,...(e.round===1?{r2:"skipped"}:{})});
   if(e.round===2&&e.state==="running") setMessage("서로의 주장을 교차 검토하고 있습니다.");}
  else if(e.type==="position") setPositions(p=>[...p,e.position]);
  else if(e.type==="done") finish(e.discussion);
  else if(e.type==="error") throw new Error(e.error);
 }
 function finish(d:Discussion){finished.current=true;setDiscussion(d);setShowAll(false);requestAnimationFrame(()=>document.querySelector(".synthesis")?.scrollIntoView({behavior:"smooth",block:"start"}));setPhase("done");setView("summary");setMessage(d.synthesis.headline);
  // Lanes for agents that had no peer to review (single survivor) end as skipped, not waiting.
  setLanes(s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,v&&v.r2==="waiting"?{...v,r2:"skipped"}:v])));}

 async function run(){
  const controller=new AbortController();abort.current=controller;
  reset();setPhase("running");setMessage(`${chosen.length}개 관점의 에이전트가 동시에 독립 탐색을 시작했습니다.`);
  setLanes(Object.fromEntries(chosen.map(l=>[l,{r1:"waiting",r2:"waiting"}])));
  const body={problem:{title:problem.title.trim(),statement:problem.statement.trim(),...(problem.context?.trim()?{context:problem.context.trim()}:{})},lenses:chosen};
  try{
   const res=await fetch("/api/discussions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
   if(!res.ok||!res.body){const d=await res.json().catch(()=>({}));throw new Error(d.error??"tool_failure");}
   const reader=res.body.getReader(),decoder=new TextDecoder();let buffer="";
   for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
    for(let i=buffer.indexOf("\n");i>=0;i=buffer.indexOf("\n")){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(line.trim())handle(JSON.parse(line));}}
   if(!finished.current)throw new Error("tool_failure");
  }catch(e){setPhase("error");setMessage(say(e instanceof Error?(e.name==="AbortError"?"cancelled":e.message):"tool_failure"));}
  finally{if(abort.current===controller)abort.current=null;}
 }

 async function importTranscript(text:string){
  reset();setPhase("running");setMessage("가져온 토론 기록을 계약으로 확인하고 종합하고 있습니다.");
  try{let parsed:unknown;try{parsed=JSON.parse(text);}catch{throw new Error("invalid_transcript");}
   const res=await fetch("/api/discussions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:parsed})});
   const d=await res.json();if(!res.ok)throw new Error(d.error);
   setProblem(d.problem);setSample("");setChosen(d.lenses);setPositions(d.positions);
   setLanes(Object.fromEntries((d as Discussion).lenses.map(l=>{const f=d.failures.filter((x:Failure)=>x.lens===l);const p=d.positions.find((x:Position)=>x.lens===l);
    return [l,{r1:p?"done":"failed",r2:f.some((x:Failure)=>x.round===2)?"failed":p?"done":"skipped",ms1:p?.durationMs,claims:p?.claims.length,reviews:d.reviews.filter((r:{lens:LensId})=>r.lens===l).length,error:f[0]?.error}];})));
   finish(d);
  }catch(e){setPhase("error");setMessage(say(e instanceof Error?e.message:"tool_failure"));}
 }

 async function register(a:RankedAction,rank:number){
  setRegistered(r=>({...r,[a.id]:"saving"}));
  try{const res=await fetch("/api/work-items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({workspace:"discussions",title:`[${lensCatalog[a.lens].title}] ${a.action}`.slice(0,200),priority:rank<2?1:rank<4?2:3})});
   if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error);}setRegistered(r=>({...r,[a.id]:"saved"}));}
  catch(e){setRegistered(r=>({...r,[a.id]:"failed"}));setMessage(say(e instanceof Error?e.message:"tool_failure"));}
 }
 function download(){if(!discussion)return;const url=URL.createObjectURL(new Blob([JSON.stringify(discussion,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`discussion-${discussion.sourceHash.slice(0,8)}.json`;a.click();URL.revokeObjectURL(url);}

 const s=discussion?.synthesis;
 const allClaims=useMemo(()=>s?[...s.contested,...s.consensus,...s.singleSource]:[],[s]);

 return <><Sidebar active="discussion"/><main><header><span>워크스페이스 / 멀티 에이전트 토론</span><span className="badge">● SYNTHETIC DEMO</span></header>
 <section className="intro"><p className="eyebrow">FIELD PROBLEM / MULTI-AGENT DISCUSSION</p><h1>한 문제를 여러 관점이 동시에.<br/><span>합의와 쟁점은 근거로 정리합니다.</span></h1><p>반도체 현장 문제 하나를 원인·검증·데이터 경계·배포·비용 관점의 에이전트가 병렬로 탐색합니다.<br/>서로의 주장을 교차 검토한 뒤 합의·쟁점·우선 확인 항목을 결정적으로 종합합니다.</p></section>
 <div className="steps"><b>01　문제 정의</b><span>→</span><b>02　독립 탐색 · 병렬</b><span>→</span><b>03　교차 검토 · 병렬</b><span>→</span><b>04　종합 · 다음 확인</b></div>

 <div className="workspace discuss-setup">
  <section className="panel"><div className="panel-head"><div><p className="eyebrow">PROBLEM PACKET</p><h2>현장 문제</h2></div></div>
   <div className="chips" role="group" aria-label="합성 예제">{samples.map(x=><button key={x.id} type="button" className={"chip"+(sample===x.id?" on":"")} aria-pressed={sample===x.id} disabled={busy} onClick={()=>choose(x.id)}>{x.label}</button>)}</div>
   <label htmlFor="p-title">제목 <span>최대 120자</span></label><input id="p-title" className="field" value={problem.title} maxLength={120} disabled={busy} onChange={e=>{setProblem({...problem,title:e.target.value});setSample("");}}/>
   <label htmlFor="p-statement">증상과 상황 <span>관측한 사실 위주 · 최대 4,000자</span></label><textarea id="p-statement" className="short" value={problem.statement} maxLength={4000} disabled={busy} onChange={e=>{setProblem({...problem,statement:e.target.value});setSample("");}}/>
   <label htmlFor="p-context">맥락·제약 <span>선택</span></label><input id="p-context" className="field" value={problem.context??""} maxLength={4000} disabled={busy} onChange={e=>setProblem({...problem,context:e.target.value})}/>
   <p className="hint">고객 원본 로그·레시피·장비 식별자는 넣지 마세요. 모든 에이전트가 같은 문제 패킷을 받습니다.</p>
  </section>
  <section className="panel"><div className="panel-head"><div><p className="eyebrow">LENS AGENTS</p><h2>탐색 관점 <small className="count">{chosen.length}/{allLenses.length}</small></h2></div></div>
   <div className="lens-grid">{allLenses.map(l=>{const on=chosen.includes(l);return <label key={l} className={"lens-option"+(on?" on":"")} style={{"--lens":lensColor[l]} as React.CSSProperties}><input type="checkbox" checked={on} disabled={busy} onChange={()=>toggle(l)}/><b>{lensCatalog[l].title}</b><small>{lensCatalog[l].question}</small><code>{lensCatalog[l].skill}</code></label>;})}</div>
   <div className="actions"><Button className="primary" disabled={busy||chosen.length<2||!problem.title.trim()||problem.statement.trim().length<10} onClick={run}>{busy?"토론 진행 중…":"병렬 토론 시작 ↗"}</Button>{busy&&abort.current&&<Button onClick={()=>abort.current?.abort()}>취소</Button>}</div>
   {chosen.length<2&&<p className="hint warn">관점을 2개 이상 선택해야 교차 검토가 성립합니다.</p>}
   <details className="import"><summary>호스트 에이전트 실행 결과 가져오기</summary><p className="hint">Claude Code·Codex에서 <code>fde-multi-agent-review</code> skill로 만든 transcript JSON을 붙여 넣으면 같은 계약으로 검사하고 종합합니다.</p>
    <textarea className="short mono" aria-label="토론 transcript JSON" spellCheck={false} value={transcript} disabled={busy} onChange={e=>setTranscript(e.target.value)} placeholder='{"version":"1","problem":{…},"lenses":[…],"positions":[…],"reviews":[…],"failures":[]}'/>
    <div className="actions"><Button disabled={busy||!transcript.trim()} onClick={()=>importTranscript(transcript)}>검사 후 종합하기</Button><label className="file">JSON 파일 선택<input type="file" accept="application/json,.json" disabled={busy} onChange={async e=>{const f=e.target.files?.[0];if(f){const t=await f.text();setTranscript(t);await importTranscript(t);}e.target.value="";}}/></label></div>
   </details>
  </section>
 </div>

 <p role="status" aria-live="polite" className={"status discuss-status "+phase}>{message}</p>

 {Object.keys(lanes).length>0&&<section className="panel lanes" aria-label="에이전트 진행 상황"><div className="panel-head"><div><p className="eyebrow">AGENTS</p><h2>병렬 실행</h2></div>{discussion&&<span className="provider">{discussion.provider.mode==="imported"?"가져온 기록":"fixture 에이전트"} · {discussion.provider.id}</span>}</div>
  {(Object.keys(lanes) as LensId[]).map(l=>{const v=lanes[l]!;return <div className="lane" key={l} style={{"--lens":lensColor[l]} as React.CSSProperties}><div className="lane-name"><i/><b>{lensCatalog[l].title}</b><code>{lensCatalog[l].skill}</code></div>
   <div className={"pill "+v.r1}>1 독립 탐색 · {stepLabel[v.r1]}{v.r1==="done"&&<> · 주장 {v.claims} · {secs(v.ms1)}</>}{v.r1==="failed"&&v.error&&<> · {errorLabel[v.error]}</>}</div>
   <div className={"pill "+v.r2}>2 교차 검토 · {stepLabel[v.r2]}{v.r2==="done"&&<> · 의견 {v.reviews}{v.ms2!==undefined&&<> · {secs(v.ms2)}</>}</>}{v.r2==="failed"&&v.error&&<> · {errorLabel[v.error]}</>}</div></div>;})}
  {busy&&positions.length>0&&<p className="hint">먼저 끝난 관점: {positions.map(p=>lensCatalog[p.lens].title).join(" · ")}</p>}
 </section>}

 {discussion&&s&&<>
  <section className="panel synthesis"><p className="eyebrow">SYNTHESIS</p><h2>{discussion.problem.title}</h2><p className="headline">{s.headline}</p>
   <div className="metrics four"><div><strong>{s.consensus.length}</strong>합의</div><div><strong>{s.contested.length}</strong>쟁점</div><div><strong>{s.singleSource.length}</strong>단일 관점</div><div><strong>{pct(s.agreement)}</strong>합의도<span className="meter" aria-hidden><span style={{width:pct(s.agreement)}}/></span></div></div>
   <p className="hint">탐색 {s.coverage.explored}/{s.coverage.requested} · 교차 검토 {s.coverage.reviewed} · 실패 {s.coverage.failed.length?s.coverage.failed.map(f=>`${lensCatalog[f.lens].title}(${f.round}차, ${errorLabel[f.error]})`).join(", "):"없음"} · SHA-256 {discussion.sourceHash.slice(0,12)}<br/>합의도 = 합의 / (합의 + 쟁점). 종합은 규칙으로 계산되며 모든 줄이 주장 id와 관점으로 추적됩니다.</p>
   <div className="tabs" role="tablist">{([["summary","종합"],["matrix","토론 매트릭스"],["positions","관점별 원문"]] as [View,string][]).map(([k,t])=><button key={k} role="tab" aria-selected={view===k} className={view===k?"on":""} onClick={()=>setView(k)}>{t}</button>)}<span className="grow"/><Button onClick={download}>토론 JSON 내보내기 ↓</Button></div>
  </section>

  {view==="summary"&&<div className="workspace summary-grid">
   <section className="panel"><p className="eyebrow">NEXT CHECKS</p><h2>우선 확인할 일</h2><p className="hint">쟁점을 판별하는 확인 → 합의를 확정하는 확인 → 단일 관점 순, 같은 점수면 비용이 낮은 것부터.</p>
    <ol className="actions-list">{s.actions.map((a,i)=><li key={a.id}><span className="rank">{i+1}</span><div><p>{a.action}</p><div className="meta"><LensTag lens={a.lens}/><span className={"cost "+a.cost}>{costLabel[a.cost]}</span><span>{a.rationale}</span>{a.resolves.map(r=><code key={r}>{r}</code>)}</div>
     <button type="button" className="link" disabled={registered[a.id]==="saving"||registered[a.id]==="saved"} onClick={()=>register(a,i)}>{registered[a.id]==="saved"?"작업으로 등록됨 ✓":registered[a.id]==="saving"?"등록 중…":registered[a.id]==="failed"?"다시 등록":"작업으로 등록 +"}</button></div></li>)}</ol>
    {!s.actions.length&&<p className="hint">제안된 확인 항목이 없습니다.</p>}
   </section>
   <section className="panel"><p className="eyebrow">CONTESTED</p><h2>쟁점 <small className="count">{s.contested.length}</small></h2>
    {s.contested.length?s.contested.map(c=><ClaimCard key={c.claim.id} c={c}/>):<p className="hint">반대 의견이 나온 주장이 없습니다. 합의가 근거 없이 나온 것은 아닌지 단일 관점 항목을 확인하세요.</p>}
    <p className="eyebrow gap">CONSENSUS</p><h2>합의 <small className="count">{s.consensus.length}</small></h2>
    <ul className="compact">{(showAll?s.consensus:s.consensus.slice(0,6)).map(c=><li key={c.claim.id}><ClaimHead c={c}/><p>{c.claim.statement}</p><small>지지: {c.supporters.map(l=>lensCatalog[l].title).join(", ")}{c.refinements.length>0&&` · 보완 의견 ${c.refinements.length}`}</small></li>)}</ul>{s.consensus.length>6&&<button type="button" className="link" aria-expanded={showAll} onClick={()=>setShowAll(v=>!v)}>{showAll?"접기":`합의 ${s.consensus.length-6}건 더 보기`}</button>}
    {s.questions.length>0&&<><p className="eyebrow gap">OPEN QUESTIONS</p><ul className="compact">{s.questions.map(q=><li key={q.text}><p>{q.text}</p><small>{q.lenses.map(l=>lensCatalog[l].title).join(", ")}</small></li>)}</ul></>}
    {s.risks.length>0&&<><p className="eyebrow gap">RISKS</p><ul className="compact">{s.risks.map(q=><li key={q.text}><p>{q.text}</p><small>{q.lenses.map(l=>lensCatalog[l].title).join(", ")}</small></li>)}</ul></>}
   </section>
  </div>}

  {view==="matrix"&&<section className="panel matrix-panel"><p className="eyebrow">STANCE MATRIX</p><h2>누가 무엇에 동의하고 반대했나</h2><p className="hint">● 작성 · ✓ 지지 · ✕ 반대 · △ 보완 · 셀에 마우스를 올리면 의견이 보입니다.</p>
   <div className="matrix-scroll"><table className="matrix"><thead><tr><th scope="col">주장</th>{discussion.lenses.map(l=><th scope="col" key={l} style={{"--lens":lensColor[l]} as React.CSSProperties}><span>{lensCatalog[l].title}</span></th>)}</tr></thead>
    <tbody>{allClaims.map(c=><tr key={c.claim.id} className={c.status}><th scope="row"><ClaimHead c={c}/><span className="stmt">{c.claim.statement}</span></th>{discussion.lenses.map(l=>{const r=discussion.reviews.find(x=>x.lens===l&&x.target===c.claim.id);const mark=c.author===l?"●":r?.stance==="support"?"✓":r?.stance==="challenge"?"✕":r?.stance==="refine"?"△":"";return <td key={l} className={r?.stance??(c.author===l?"author":"")} title={c.author===l?"작성한 관점":r?.note}>{mark}<span className="sr-only">{c.author===l?"작성":r?`${r.stance}: ${r.note}`:"의견 없음"}</span></td>;})}</tr>)}</tbody></table></div>
  </section>}

  {view==="positions"&&<div className="positions">{discussion.positions.map(p=><section key={p.lens} className="panel position" style={{"--lens":lensColor[p.lens]} as React.CSSProperties}><p className="eyebrow">{p.skill} · {secs(p.durationMs)}</p><h2>{lensCatalog[p.lens].title}</h2><p className="summary">{p.summary}</p>
   <ul className="compact">{p.claims.map(c=><li key={c.id}><span className="claim-head"><code>{c.id}</code><span className={"kind "+c.kind}>{kindLabel[c.kind]}</span><span className="conf">확신 {pct(c.confidence)}</span></span><p>{c.statement}</p>{c.evidence&&<small>근거: {c.evidence}</small>}</li>)}</ul>
   {p.nextChecks.length>0&&<><p className="eyebrow gap">다음 확인</p><ul className="compact">{p.nextChecks.map(n=><li key={n.id}><p>{n.action}</p><small>{costLabel[n.cost]} · {n.resolves.join(", ")}</small></li>)}</ul></>}
  </section>)}{discussion.failures.filter(f=>f.round===1).map(f=><section key={f.lens} className="panel position failed" style={{"--lens":lensColor[f.lens]} as React.CSSProperties}><p className="eyebrow">{lensCatalog[f.lens].skill}</p><h2>{lensCatalog[f.lens].title}</h2><p className="summary">이 관점은 결과를 내지 못했습니다({errorLabel[f.error]}). 종합에서 빠진 관점으로 표시됩니다.</p></section>)}</div>}
 </>}
 {!discussion&&phase!=="running"&&<div className="panel empty discuss-empty"><span>◎</span><h3>아직 토론 결과가 없습니다</h3><p>관점을 고르고 토론을 시작하면 에이전트가 동시에 탐색하고,<br/>서로의 주장을 검토한 뒤 합의·쟁점·다음 확인 항목을 정리합니다.</p></div>}
 <footer>FDE SERVICE TEMPLATE <span>병렬 탐색 · 교차 검토 · 추적 가능한 종합</span></footer></main></>;
}

function ClaimHead({c}:{c:SynthesizedClaim}){return <span className="claim-head"><code>{c.claim.id}</code><span className={"status-pill "+c.status}>{c.status==="consensus"?"합의":c.status==="contested"?"쟁점":"단일 관점"}</span><span className={"kind "+c.claim.kind}>{kindLabel[c.claim.kind]}</span><span className="conf">확신 {pct(c.claim.confidence)}</span></span>;}
function ClaimCard({c}:{c:SynthesizedClaim}){return <article className="claim-card"><ClaimHead c={c}/><p className="stmt">{c.claim.statement}</p><div className="meta"><span>작성</span><LensTag lens={c.author}/>{c.supporters.length>0&&<><span>지지</span>{c.supporters.map(l=><LensTag key={l} lens={l}/>)}</>}</div>
 <ul className="remarks">{c.challenges.map(r=><li key={r.lens} className="challenge"><b>✕ {lensCatalog[r.lens].title}</b> {r.note}</li>)}{c.refinements.map(r=><li key={r.lens} className="refine"><b>△ {lensCatalog[r.lens].title}</b> {r.note}</li>)}</ul></article>;}
