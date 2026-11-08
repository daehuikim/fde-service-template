// Per-user working memory. Private entries are visible only to their owner (enforced by RLS in live mode).
import {readBody,failure} from "../guard";
import {store,authenticate,string,onlyKeys} from "../session";
import {requirePermission} from "../../../../../packages/auth";
export async function GET(req:Request){try{const {principal}=await authenticate(req);if(principal.kind!=="user") throw new Error("forbidden");const ws=new URL(req.url).searchParams.get("workspace");const s=await store();const wsId=ws?await s.ensureWorkspace(principal,string(ws,40,/^[a-z0-9-]{1,40}$/),ws):null;return Response.json({entries:await s.listMemory(principal,wsId)},{headers:{"cache-control":"no-store"}});}catch(e){return failure(e);}}
export async function PUT(req:Request){try{const {principal}=await authenticate(req);if(principal.kind!=="user") throw new Error("forbidden");const b=await readBody(req);onlyKeys(b,["key","value","visibility","workspace"]);
 const key=string(b.key,80,/^[a-z0-9_.-]{1,80}$/);const visibility=b.visibility===undefined?"private":string(b.visibility,10,/^(private|workspace|tenant)$/) as "private"|"workspace"|"tenant";
 if(visibility!=="private") requirePermission(principal,"memory:write_shared");if(!("value" in b)||JSON.stringify(b.value).length>30000) throw new Error("invalid_input");
 const s=await store();const wsId=b.workspace===undefined?null:await s.ensureWorkspace(principal,string(b.workspace,40,/^[a-z0-9-]{1,40}$/),String(b.workspace));if(visibility==="workspace"&&!wsId) throw new Error("invalid_input");
 return Response.json(await s.upsertMemory(principal,{key,value:b.value,visibility,workspaceId:wsId}));}catch(e){return failure(e);}}
