// Multi-agent discussion API.
// POST {problem, lenses}  → NDJSON stream of agent events, ending with {"type":"done","discussion":…}
// POST {transcript}       → JSON discussion, re-checked and re-synthesized from a host-run transcript
// Both need run:create. Only the offline fixture provider ships; live mode needs a provider registered here.
import {readBody,failure} from "../guard";
import {authenticate,onlyKeys} from "../session";
import {requirePermission} from "../../../../../packages/auth";
import {runDiscussion,synthesizeTranscript,parseRequest,discussionCapability,type AgentProvider} from "../../../../../packages/agents";
import {fixtureProvider} from "../../../../../packages/agents/fixture";
function provider():AgentProvider{
 if((process.env.APP_MODE??"fixture")==="fixture"){if(process.env.NODE_ENV==="production") throw new Error("fixture_disabled_in_production");return fixtureProvider({simulateLatency:process.env.DISCUSSION_LATENCY!=="off"});}
 throw new Error("provider_unavailable");
}
export async function POST(req:Request){try{
 const {principal}=await authenticate(req);requirePermission(principal,"run:create");
 const b=await readBody(req);
 if("transcript" in b){onlyKeys(b,["transcript"]);return Response.json(await synthesizeTranscript(b.transcript,{signal:req.signal}),{headers:{"cache-control":"no-store"}});}
 onlyKeys(b,["problem","lenses"]);const input=parseRequest(b);const agents=provider();
 const total=AbortSignal.any([req.signal,AbortSignal.timeout(discussionCapability.totalTimeoutMs)]);const enc=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({async start(c){
  const send=(e:unknown)=>{try{c.enqueue(enc.encode(JSON.stringify(e)+"\n"));}catch{}};
  try{await runDiscussion(input,agents,{signal:total,onEvent:send});}catch(e){send({type:"error",error:e instanceof Error&&e.message==="cancelled"?"cancelled":"tool_failure"});}
  try{c.close();}catch{}
 }});
 return new Response(stream,{headers:{"content-type":"application/x-ndjson; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}catch(e){return failure(e);}}
