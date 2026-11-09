import {timingSafeEqual} from "node:crypto";
export function guard(req:Request){
 const mode=process.env.APP_MODE??"fixture";
 if(mode!=="fixture"&&mode!=="live") throw new Error("invalid_mode");
 if(mode==="fixture") {if(process.env.NODE_ENV==="production") throw new Error("fixture_disabled_in_production");return {tenant:"demo",subject:"synthetic-demo",signal:req.signal};}
 const expected=process.env.SERVICE_TOKEN;const supplied=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!expected||expected.length<32||!supplied||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) throw new Error("unauthorized");
 if(!process.env.SERVICE_TENANT)throw new Error("missing_tenant");
 return {tenant:process.env.SERVICE_TENANT,subject:"service-client",signal:req.signal};
}
export async function readBody(req:Request){if(!req.headers.get("content-type")?.startsWith("application/json"))throw new Error("content_type");const reader=req.body?.getReader();if(!reader)throw new Error("empty_input");let bytes=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>210000){await reader.cancel();throw new Error("input_too_large");}chunks.push(value);}return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string,unknown>;}
export function failure(e:unknown){const code=e instanceof Error?e.message:"tool_failure";const exposed=["unauthorized","forbidden","csrf_rejected","too_many_attempts","no_membership","not_found","version_conflict","email_taken","weak_password","input_too_large","invalid_headers","invalid_row_count","duplicate_header","invalid_input","content_type","idempotency_conflict","fixture_disabled_in_production","database_unavailable","invalid_transcript","stale_verification"].includes(code)?code:"tool_failure";const status=({unauthorized:401,forbidden:403,csrf_rejected:403,too_many_attempts:429,no_membership:403,not_found:404,version_conflict:409,idempotency_conflict:409,stale_verification:409,email_taken:409,input_too_large:413} as Record<string,number>)[exposed]??400;return Response.json({error:exposed},{status,headers:{"cache-control":"no-store"}});}
