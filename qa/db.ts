import assert from "node:assert/strict";
import {db,saveRun} from "../packages/db";
import {postgresStore as store} from "../packages/db/identity";
import {validateCsv} from "../packages/tools";
if(!process.env.DATABASE_URL){console.error("blocked: DATABASE_URL is required; no DB tests executed");process.exit(2);}
const sql=db();const stamp=Date.now();const ctx={tenant:"qa-"+stamp,subject:"qa"};const r=validateCsv("request_id,title,department,amount\nR,요청,support,1");r.mode="live";
const tenantA="qa-a-"+stamp,tenantB="qa-b-"+stamp;const users:string[]=[];
try{
 const [role]=await sql`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`;assert(!role.rolsuper&&!role.rolbypassrls,"Use a non-superuser/non-BYPASSRLS runtime role");
 const saved=await Promise.all(Array.from({length:12},()=>saveRun(ctx,"concurrent-key",r)));assert.equal(new Set(saved.map(x=>x.id)).size,1);
 await assert.rejects(()=>saveRun(ctx,"concurrent-key",{...r,sourceHash:"a".repeat(64)}),/idempotency_conflict/);
 await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', 'other-tenant', true)");assert.equal((await tx.unsafe('select * from runs where tenant_id=$1',[ctx.tenant])).length,0);});
 await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', 'other-tenant', true)");await tx.unsafe("insert into runs(tenant_id,idempotency_key,payload_hash,result) values($1,'forged',$2,'{\"version\":\"1\"}')",[ctx.tenant,"a".repeat(64)]);}));
 console.log("pass: concurrent idempotency, conflict rollback, RLS read/write isolation");

 // Identity, RBAC and per-user memory on the real schema.
 await store.createTenant(tenantA,"QA A");await store.createTenant(tenantB,"QA B");
 const owner=await store.createUser({email:`owner-${stamp}@example.com`,password:"qa-owner-password",displayName:"Owner"});
 const viewer=await store.createUser({email:`viewer-${stamp}@example.com`,password:"qa-viewer-password",displayName:"Viewer"});
 const outsider=await store.createUser({email:`outsider-${stamp}@example.com`,password:"qa-outsider-password",displayName:"Outsider"});users.push(owner.id,viewer.id,outsider.id);
 await store.addMember(tenantA,owner.id,"owner");await store.addMember(tenantA,viewer.id,"viewer");await store.addMember(tenantB,outsider.id,"owner");
 await assert.rejects(()=>store.login({email:owner.email,password:"wrong"}),/unauthorized/);
 const o=await store.login({email:owner.email,password:"qa-owner-password"});assert.equal(o.tenant,tenantA);
 const op=await store.resolveSession(o.token);assert(op&&op.permissions.has("tenant:manage")&&op.tenant===tenantA);
 const v=await store.login({email:viewer.email,password:"qa-viewer-password"});const vp=await store.resolveSession(v.token);assert(vp&&!vp.permissions.has("work_item:create")&&vp.permissions.has("work_item:read"));
 const x=await store.login({email:outsider.email,password:"qa-outsider-password"});const xp=await store.resolveSession(x.token);assert(xp&&xp.tenant===tenantB);
 assert.equal((await sql.unsafe("select 1 from sessions where token_hash=$1",[o.token])).length,0,"raw session token must never be stored");
 const ws=await store.ensureWorkspace(op,"field","Field");const item=await store.createWorkItem(op,{workspaceId:ws,title:"RLS check"});
 // Cross-tenant: tenant B cannot read, update, or attach children to tenant A rows, even with the right ids.
 assert.equal((await store.listWorkItems(xp,ws)).length,0);
 await assert.rejects(()=>store.updateWorkItem(xp,item.id,1,{status:"done"}),/not_found/);
 await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true), set_config('app.user',$2,true)",[tenantB,outsider.id]);await tx.unsafe("insert into comments(tenant_id,work_item_id,author_id,body) values($1,$2,$3,'forged')",[tenantB,item.id,outsider.id]);}),/violates foreign key|row-level security/);
 // Optimistic concurrency + append-only history.
 const updated=await store.updateWorkItem(op,item.id,1,{status:"in_progress"});assert.equal(updated.version,2);
 await assert.rejects(()=>store.updateWorkItem(op,item.id,1,{status:"done"}),/version_conflict/);
 await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true)",[tenantA]);await tx.unsafe("update work_item_events set kind='forged' where work_item_id=$1",[item.id]);}),/append_only_table/);
 // audit_log has no UPDATE/DELETE policy at all (RLS default-deny) and a deny trigger behind it.
 const touched=await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true)",[tenantA]);return (await tx.unsafe("update audit_log set action='user.renamed' where tenant_id=$1",[tenantA])).count;});assert.equal(touched,0);
 // Per-user memory: private rows invisible to other members, shared rows visible, cross-tenant invisible.
 await store.upsertMemory(op,{key:"draft",value:{secret:true}});await store.upsertMemory(op,{key:"shared",value:1,visibility:"tenant"});
 const seenByViewer=(await store.listMemory(vp,null)).map(m=>m.key);assert.deepEqual(seenByViewer.sort(),["shared"]);
 assert.equal((await store.listMemory(xp,null)).length,0);
 await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true), set_config('app.user',$2,true)",[tenantA,viewer.id]);await tx.unsafe("update memory_entries set value='\"tampered\"' where user_id=$1",[owner.id]);const [{n}]=await tx.unsafe("select count(*)::int as n from memory_entries where user_id=$1 and value='\"tampered\"'",[owner.id]) as unknown as {n:number}[];if(n===0) throw new Error("no_rows_touched");}),/no_rows_touched/);
 // A tenant cannot grant another tenant's custom role.
 await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true)",[tenantB]);const [rb]=await tx.unsafe("insert into roles(tenant_id,key,name) values($1,'auditor','Auditor') returning id",[tenantB]) as unknown as {id:string}[];await tx.unsafe("select set_config('app.tenant',$1,true)",[tenantA]);await tx.unsafe("insert into membership_roles(tenant_id,user_id,role_id) values($1,$2,$3)",[tenantA,viewer.id,rb.id]);}),/role_tenant_mismatch|row-level security/);
 // Audit trail and outbox were written in the same transactions.
 const audits=await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true)",[tenantA]);return tx.unsafe("select action from audit_log where tenant_id=$1 order by id",[tenantA]) as unknown as Promise<{action:string}[]>;});
 assert.deepEqual(audits.map(a=>a.action).filter(a=>a.startsWith("work_item")),["work_item.created","work_item.updated"]);
 const outbox=await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant',$1,true)",[tenantA]);return tx.unsafe("select topic from outbox_events where tenant_id=$1",[tenantA]);});assert.equal(outbox.length,1);
 // Session lifecycle: revoke, then the token is dead; lockout after repeated failures.
 await store.revokeSession(o.token);assert.equal(await store.resolveSession(o.token),null);
 for(let i=0;i<10;i++) await store.login({email:viewer.email,password:"wrong"}).catch(()=>{});
 await assert.rejects(()=>store.login({email:viewer.email,password:"qa-viewer-password"}),/too_many_attempts/);
 console.log("pass: identity, sessions, RBAC, cross-tenant RLS on workspace tables, append-only audit, per-user memory, lockout");
}finally{
 await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', $1, true)",[ctx.tenant]);await tx.unsafe("delete from runs where tenant_id=$1",[ctx.tenant]);});
 for(const u of users) await sql.unsafe("delete from users where id=$1",[u]);
 await sql.unsafe("delete from tenants where id in ($1,$2)",[tenantA,tenantB]);await sql.unsafe("delete from login_attempts where email like $1",[`%-${stamp}@example.com`]);
 await sql.end();
}
