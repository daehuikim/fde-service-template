// PostgreSQL store for accounts, sessions, RBAC and per-user working memory.
// Every tenant-scoped query runs inside withPrincipal(), which pins app.tenant / app.user for RLS.
import type {TransactionSql} from "postgres";
import {db} from "./index";
import {hashPassword,verifyPassword,newSecret,hashSecret,sessionPolicy,systemRoles,type Principal} from "../auth";
import type {Store,User,WorkItem,MemoryEntry,LoginInput} from "./store";
type Tx=TransactionSql<Record<string,never>>;
const idPattern=/^[a-z0-9-]{1,64}$/;
async function withPrincipal<T>(p:{tenant:string;id?:string},fn:(tx:Tx)=>Promise<T>):Promise<T>{
 if(!idPattern.test(p.tenant)) throw new Error("unauthorized");
 return db().begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true), set_config('app.user',$2,true)",[p.tenant,p.id??""]);return fn(tx);}) as Promise<T>;
}
async function audit(tx:Tx,e:{tenant?:string|null;actor?:string|null;kind:Principal["kind"]|"system";action:string;target?:[string,string];meta?:object}){
 await tx.unsafe("insert into audit_log(tenant_id,actor_id,actor_kind,action,target_kind,target_id,metadata) values($1,$2,$3,$4,$5,$6,$7::jsonb)",[e.tenant??null,e.actor??null,e.kind,e.action,e.target?.[0]??null,e.target?.[1]??null,JSON.stringify(e.meta??{})]);
}
export const postgresStore:Store={
 async createTenant(id,name){const sql=db();await sql.unsafe("insert into tenants(id,name) values($1,$2) on conflict do nothing",[id,name]);},
 async createUser({email,password,displayName}){
  const sql=db();const phc=hashPassword(password);
  return sql.begin(async tx=>{const [u]=await tx.unsafe("insert into users(email,display_name) values($1,$2) returning id,email,display_name",[email,displayName]) as unknown as {id:string;email:string;display_name:string}[];
   await tx.unsafe("insert into user_credentials(user_id,algorithm,phc) values($1,'scrypt',$2)",[u.id,phc]);await audit(tx,{actor:u.id,kind:"system",action:"user.created",target:["user",u.id]});
   return {id:u.id,email:u.email,displayName:u.display_name};});
 },
 async addMember(tenant,userId,role){
  const grants=systemRoles[role];if(!grants) throw new Error("unknown_role");
  await withPrincipal({tenant},async tx=>{await tx.unsafe("insert into memberships(tenant_id,user_id) values($1,$2) on conflict do nothing",[tenant,userId]);
   await tx.unsafe("insert into membership_roles(tenant_id,user_id,role_id) select $1,$2,id from roles where tenant_id is null and key=$3 on conflict do nothing",[tenant,userId,role]);
   await audit(tx,{tenant,kind:"system",action:"member.added",target:["user",userId],meta:{role}});});
 },
 async login({email,password,tenant}:LoginInput){
  const sql=db();
  const [{failures}]=await sql.unsafe("select count(*)::int as failures from login_attempts where email=$1 and not succeeded and attempted_at > now() - make_interval(mins => $2)",[email,sessionPolicy.loginWindowMinutes]) as unknown as {failures:number}[];
  if(failures>=sessionPolicy.loginMaxFailures) throw new Error("too_many_attempts");
  const rows=await sql.unsafe("select u.id,u.email,u.display_name,c.phc from users u join user_credentials c on c.user_id=u.id where u.email=$1 and u.status='active'",[email]) as unknown as {id:string;email:string;display_name:string;phc:string}[];
  const ok=rows.length===1&&verifyPassword(password,rows[0].phc);
  if(rows.length===0) verifyPassword(password,"$scrypt$ln=17,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"); // equalize timing
  await sql.unsafe("insert into login_attempts(email,succeeded) values($1,$2)",[email,ok]);
  if(!ok) throw new Error("unauthorized");
  const user=rows[0];
  const memberships=await withPrincipal({tenant:"none",id:user.id},tx=>tx.unsafe("select tenant_id from memberships where user_id=$1 and status='active' order by created_at",[user.id]) as unknown as Promise<{tenant_id:string}[]>);
  const active=tenant??memberships[0]?.tenant_id;
  if(!active||!memberships.some(m=>m.tenant_id===active)) throw new Error("no_membership");
  const {secret,hash}=newSecret();
  await withPrincipal({tenant:active,id:user.id},async tx=>{await tx.unsafe("insert into sessions(user_id,token_hash,tenant_id,idle_expires_at,absolute_expires_at) values($1,$2,$3,now()+make_interval(mins=>$4),now()+make_interval(hours=>$5))",[user.id,hash,active,sessionPolicy.idleMinutes,sessionPolicy.absoluteHours]);await audit(tx,{tenant:active,actor:user.id,kind:"user",action:"session.created"});});
  return {token:secret,user:{id:user.id,email:user.email,displayName:user.display_name},tenant:active};
 },
 async resolveSession(token){
  const sql=db();
  const rows=await sql.unsafe("update sessions set last_seen_at=now(), idle_expires_at=least(absolute_expires_at, now()+make_interval(mins=>$2)) where token_hash=$1 and revoked_at is null and idle_expires_at>now() and absolute_expires_at>now() returning id,user_id,tenant_id",[hashSecret(token),sessionPolicy.idleMinutes]) as unknown as {id:string;user_id:string;tenant_id:string|null}[];
  if(rows.length!==1||!rows[0].tenant_id) return null;
  const s={id:rows[0].id,user_id:rows[0].user_id,tenant_id:rows[0].tenant_id};
  const perms=await withPrincipal({tenant:s.tenant_id,id:s.user_id},tx=>tx.unsafe("select effective_permissions($1,$2) as p",[s.tenant_id,s.user_id]) as unknown as Promise<{p:string}[]>);
  return {kind:"user",id:s.user_id,tenant:s.tenant_id,sessionId:s.id,permissions:new Set(perms.map(r=>r.p))};
 },
 async revokeSession(token){await db().unsafe("update sessions set revoked_at=now() where token_hash=$1 and revoked_at is null",[hashSecret(token)]);},
 async me(p){const [u]=await db().unsafe("select id,email,display_name from users where id=$1",[p.id]) as unknown as {id:string;email:string;display_name:string}[];return u?{id:u.id,email:u.email,displayName:u.display_name}:null;},
 async ensureWorkspace(p,key,name){return withPrincipal(p,async tx=>{const [w]=await tx.unsafe("insert into workspaces(tenant_id,key,name,created_by) values($1,$2,$3,$4) on conflict(tenant_id,key) do update set name=excluded.name returning id",[p.tenant,key,name,p.kind==="user"?p.id:null]) as unknown as {id:string}[];return w.id;});},
 async createWorkItem(p,input){
  return withPrincipal(p,async tx=>{
   const [w]=await tx.unsafe("insert into work_items(tenant_id,workspace_id,title,body,priority,created_by) values($1,$2,$3,$4,$5,$6) returning id,title,status,priority,version,workspace_id,updated_at",[p.tenant,input.workspaceId,input.title,input.body??"",input.priority??3,p.kind==="user"?p.id:null]) as unknown as WorkItem[];
   await tx.unsafe("insert into work_item_events(tenant_id,work_item_id,actor_id,kind,payload) values($1,$2,$3,'created',$4::jsonb)",[p.tenant,w.id,p.kind==="user"?p.id:null,JSON.stringify({title:input.title})]);
   await tx.unsafe("insert into outbox_events(tenant_id,topic,payload) values($1,'work_item.created',$2::jsonb)",[p.tenant,JSON.stringify({id:w.id})]);
   await audit(tx,{tenant:p.tenant,actor:p.id,kind:p.kind,action:"work_item.created",target:["work_item",w.id]});
   return w;});
 },
 async updateWorkItem(p,id,expectedVersion,patch){
  return withPrincipal(p,async tx=>{
   const [w]=await tx.unsafe("update work_items set title=coalesce($3,title), status=coalesce($4,status), priority=coalesce($5,priority) where tenant_id=$1 and id=$2 and version=$6 and deleted_at is null returning id,title,status,priority,version,workspace_id,updated_at",[p.tenant,id,patch.title??null,patch.status??null,patch.priority??null,expectedVersion]) as unknown as WorkItem[];
   if(!w){const exists=await tx.unsafe("select 1 from work_items where tenant_id=$1 and id=$2 and deleted_at is null",[p.tenant,id]);throw new Error(exists.length?"version_conflict":"not_found");}
   await tx.unsafe("insert into work_item_events(tenant_id,work_item_id,actor_id,kind,payload) values($1,$2,$3,'updated',$4::jsonb)",[p.tenant,id,p.kind==="user"?p.id:null,JSON.stringify(patch)]);
   await audit(tx,{tenant:p.tenant,actor:p.id,kind:p.kind,action:"work_item.updated",target:["work_item",id]});
   return w;});
 },
 async listWorkItems(p,workspaceId,limit=50){return withPrincipal(p,tx=>tx.unsafe("select id,title,status,priority,version,workspace_id,updated_at from work_items where tenant_id=$1 and workspace_id=$2 and deleted_at is null order by updated_at desc limit $3",[p.tenant,workspaceId,Math.min(limit,200)]) as unknown as Promise<WorkItem[]>);},
 async upsertMemory(p,e){
  if(p.kind!=="user") throw new Error("forbidden");
  return withPrincipal(p,async tx=>{const [m]=await tx.unsafe("insert into memory_entries(tenant_id,user_id,workspace_id,key,value,visibility) values($1,$2,$3,$4,$5::jsonb,$6) on conflict(tenant_id,user_id,workspace_id,key) do update set value=excluded.value, visibility=excluded.visibility returning key,value,visibility,workspace_id,updated_at",[p.tenant,p.id,e.workspaceId??null,e.key,JSON.stringify(e.value),e.visibility??"private"]) as unknown as MemoryEntry[];return m;});
 },
 async listMemory(p,workspaceId){return withPrincipal(p,tx=>tx.unsafe("select key,value,visibility,workspace_id,updated_at from memory_entries where tenant_id=$1 and (workspace_id=$2 or ($2::uuid is null and workspace_id is null)) order by updated_at desc limit 200",[p.tenant,workspaceId??null]) as unknown as Promise<MemoryEntry[]>);},
};
export type {Store,User,WorkItem,MemoryEntry} from "./store";
