// Request → Principal. Browser users carry an HttpOnly session cookie; service clients carry the bearer token.
// Both end up as the same Principal shape so routes authorize with requirePermission() only.
import {readSessionCookie,assertSameOrigin,systemRoles,type Principal} from "../../../../packages/auth";
import type {Store} from "../../../../packages/db/store";
import {fixtureStore} from "../../../../packages/db/fixture";
import {guard} from "./guard";
export function store():Promise<Store>{
 const mode=process.env.APP_MODE??"fixture";
 if(mode==="fixture"){if(process.env.NODE_ENV==="production") throw new Error("fixture_disabled_in_production");return fixtureStore();}
 if(mode!=="live") throw new Error("invalid_mode");
 return import("../../../../packages/db/identity").then(m=>m.postgresStore);
}
export const secureCookies=()=>(process.env.APP_ORIGIN??"").startsWith("https://");
export async function authenticate(req:Request):Promise<{principal:Principal;token:string|null}>{
 const token=readSessionCookie(req);
 if(token){assertSameOrigin(req,process.env.APP_ORIGIN);const principal=await (await store()).resolveSession(token);if(!principal) throw new Error("unauthorized");return {principal,token};}
 const ctx=guard(req); // bearer or fixture service context
 const perms=new Set(process.env.APP_MODE==="live"?(process.env.SERVICE_PERMISSIONS??systemRoles.member.join(",")).split(",").map(s=>s.trim()).filter(Boolean):systemRoles.member);
 return {principal:{kind:"service",id:ctx.subject,tenant:ctx.tenant,permissions:perms},token:null};
}
export function string(v:unknown,max:number,pattern?:RegExp):string{if(typeof v!=="string"||v.length===0||v.length>max||(pattern&&!pattern.test(v))) throw new Error("invalid_input");return v;}
export function onlyKeys(body:Record<string,unknown>,allowed:string[]){if(Object.keys(body).some(k=>!allowed.includes(k))) throw new Error("invalid_input");}
