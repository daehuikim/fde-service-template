import assert from "node:assert/strict";
import {db,saveRun} from "../packages/db";
import {validateCsv} from "../packages/tools";
if(!process.env.DATABASE_URL){console.error("blocked: DATABASE_URL is required; no DB tests executed");process.exit(2);}
const sql=db();const ctx={tenant:"qa-"+Date.now(),subject:"qa"};const r=validateCsv("request_id,title,department,amount\nR,요청,support,1");r.mode="live";
try{
 const [role]=await sql`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`;assert(!role.rolsuper&&!role.rolbypassrls,"Use a non-superuser/non-BYPASSRLS runtime role");
 const saved=await Promise.all(Array.from({length:12},()=>saveRun(ctx,"concurrent-key",r)));assert.equal(new Set(saved.map(x=>x.id)).size,1);
 await assert.rejects(()=>saveRun(ctx,"concurrent-key",{...r,sourceHash:"a".repeat(64)}),/idempotency_conflict/);
 await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', 'other-tenant', true)");assert.equal((await tx.unsafe('select * from runs where tenant_id=$1',[ctx.tenant])).length,0);});
 await assert.rejects(()=>sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', 'other-tenant', true)");await tx.unsafe("insert into runs(tenant_id,idempotency_key,payload_hash,result) values($1,'forged',$2,'{\"version\":\"1\"}')",[ctx.tenant,"a".repeat(64)]);}));
 console.log("pass: concurrent idempotency, conflict rollback, RLS read/write isolation");
}finally{await sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', $1, true)",[ctx.tenant]);await tx.unsafe("delete from runs where tenant_id=$1",[ctx.tenant]);});await sql.end();}
