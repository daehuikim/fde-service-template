import {failure} from "../../guard";
import {store,secureCookies} from "../../session";
import {readSessionCookie,assertSameOrigin,sessionCookie} from "../../../../../../packages/auth";
export async function POST(req:Request){try{assertSameOrigin(req,process.env.APP_ORIGIN);const token=readSessionCookie(req);if(token) await (await store()).revokeSession(token);return new Response(null,{status:204,headers:{"set-cookie":sessionCookie(null,secureCookies()),"cache-control":"no-store"}});}catch(e){return failure(e);}}
