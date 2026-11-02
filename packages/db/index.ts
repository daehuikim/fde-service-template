import postgres from "postgres";
import { createHash } from "node:crypto";
import { authorize, type ToolContext } from "../tools";
import {assertResult, type ValidationResult } from "../contracts";
let connection:ReturnType<typeof postgres>|undefined;
export function db(){if(!process.env.DATABASE_URL) throw new Error("database_unavailable"); return connection ??=postgres(process.env.DATABASE_URL,{max:5,connect_timeout:5,idle_timeout:20});}
export async function saveRun(ctx:ToolContext,key:string,result:ValidationResult){
 authorize(ctx); assertResult(result); if(!/^[a-zA-Z0-9-]{8,80}$/.test(key)) throw new Error("invalid_idempotency_key");
 const sql=db(); const hash=createHash("sha256").update(JSON.stringify({...result,evidence:[]})).digest("hex");
 return sql.begin(async tx=>{await tx.unsafe("select set_config('app.tenant', $1, true)",[ctx.tenant]);
 const [r]=await tx.unsafe("insert into runs(tenant_id,idempotency_key,payload_hash,result) values($1,$2,$3,$4::jsonb) on conflict(tenant_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id,payload_hash",[ctx.tenant,key,hash,JSON.stringify(result)]);
 if(r.payload_hash!==hash) throw new Error("idempotency_conflict"); return {id:r.id as string};});
}
