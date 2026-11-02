import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { inspect } from "../domain";
import {assertResult, type ValidationResult } from "../contracts";
export const csvCapability = {id:"csv.validate.v1",sideEffects:false,timeoutMs:5000,retries:0,idempotent:true,externalTransfer:false,maxBytes:200000,maxRows:1000};
export function validateCsv(csv:string, signal?:AbortSignal):ValidationResult {
 const start=performance.now(); signal?.throwIfAborted();
 if(Buffer.byteLength(csv)>csvCapability.maxBytes) throw new Error("input_too_large");
 let headers:string[]=[];
 const rows = parse(csv,{bom:true,skip_empty_lines:true,columns:(h:string[])=>{headers=h; if(new Set(h).size!==h.length) throw new Error("duplicate_header"); return h;},max_record_size:10000}) as Record<string,unknown>[];
 if(headers.length!==4 || !["request_id","title","department","amount"].every(k=>headers.includes(k))) throw new Error("invalid_headers");
 if(rows.length===0||rows.length>csvCapability.maxRows) throw new Error("invalid_row_count");
 // CSV is textual; only canonical integer strings are decoded. No schema coercion.
 for(const r of rows) if(typeof r.amount==="string" && /^(0|[1-9][0-9]*)$/.test(r.amount)) r.amount=Number(r.amount);
 signal?.throwIfAborted(); const issues=inspect(rows);
 const result:ValidationResult = {version:"1",mode:"fixture",sourceHash:createHash("sha256").update(csv).digest("hex"),total:rows.length,accepted:rows.length-new Set(issues.map(i=>i.row)).size,rows,issues,evidence:[{tool:"csv-parse + ajv + domain",version:"7.0.3 / 8.20.0 / 1",durationMs:Math.round((performance.now()-start)*100)/100}]};
 assertResult(result);return result;
}
export interface ToolContext {tenant:string;subject:string;signal?:AbortSignal}
export function authorize(context:ToolContext) {if(!/^[a-z0-9-]{1,64}$/.test(context.tenant)||!context.subject) throw new Error("unauthorized");context.signal?.throwIfAborted();}
