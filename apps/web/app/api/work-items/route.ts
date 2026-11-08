import {readBody,failure} from "../guard";
import {store,authenticate,string,onlyKeys} from "../session";
import {requirePermission} from "../../../../../packages/auth";
const workspaceKey=/^[a-z0-9-]{1,40}$/;
export async function GET(req:Request){try{const {principal}=await authenticate(req);requirePermission(principal,"work_item:read");const s=await store();const key=new URL(req.url).searchParams.get("workspace")??"default";if(!workspaceKey.test(key)) throw new Error("invalid_input");const ws=await s.ensureWorkspace(principal,key,key);return Response.json({workspace:ws,items:await s.listWorkItems(principal,ws)},{headers:{"cache-control":"no-store"}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const {principal}=await authenticate(req);requirePermission(principal,"work_item:create");const b=await readBody(req);onlyKeys(b,["workspace","title","body","priority"]);
 const key=b.workspace===undefined?"default":string(b.workspace,40,workspaceKey);const title=string(b.title,200);const body=b.body===undefined?undefined:string(b.body,20000);const priority=b.priority===undefined?undefined:Number(b.priority);if(priority!==undefined&&!(Number.isInteger(priority)&&priority>=1&&priority<=5)) throw new Error("invalid_input");
 const s=await store();const ws=await s.ensureWorkspace(principal,key,key);return Response.json(await s.createWorkItem(principal,{workspaceId:ws,title,body,priority}),{status:201});}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{const {principal}=await authenticate(req);requirePermission(principal,"work_item:update");const b=await readBody(req);onlyKeys(b,["id","version","title","status","priority"]);
 const id=string(b.id,36,/^[0-9a-f-]{36}$/);const version=Number(b.version);if(!Number.isInteger(version)||version<1) throw new Error("invalid_input");
 const patch={title:b.title===undefined?undefined:string(b.title,200),status:b.status===undefined?undefined:string(b.status,20,/^(open|in_progress|blocked|done|cancelled)$/),priority:b.priority===undefined?undefined:Number(b.priority)};
 if(patch.priority!==undefined&&!(Number.isInteger(patch.priority)&&patch.priority>=1&&patch.priority<=5)) throw new Error("invalid_input");
 return Response.json(await (await store()).updateWorkItem(principal,id,version,patch));}catch(e){return failure(e);}}
