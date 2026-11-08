import {readBody,failure} from "../../guard";
import {store,secureCookies,string,onlyKeys} from "../../session";
import {sessionCookie,assertSameOrigin,normalizeEmail} from "../../../../../../packages/auth";
export async function POST(req:Request){try{
 if(process.env.APP_MODE==="fixture"&&process.env.NODE_ENV==="production") throw new Error("fixture_disabled_in_production");
 assertSameOrigin(req,process.env.APP_ORIGIN);
 const b=await readBody(req);onlyKeys(b,["email","password","tenant"]);
 const email=normalizeEmail(b.email);if(!email) throw new Error("invalid_input");
 const password=string(b.password,256);const tenant=b.tenant===undefined?undefined:string(b.tenant,64,/^[a-z0-9-]{1,64}$/);
 const s=await store();const {token,user,tenant:active}=await s.login({email,password,tenant});
 const principal=await s.resolveSession(token);
 return Response.json({user,tenant:active,permissions:[...(principal?.permissions??[])].sort()},{headers:{"set-cookie":sessionCookie(token,secureCookies()),"cache-control":"no-store"}});
}catch(e){return failure(e);}}
