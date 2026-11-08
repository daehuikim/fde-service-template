import {failure} from "../../guard";
import {store,authenticate} from "../../session";
export async function GET(req:Request){try{const {principal}=await authenticate(req);const user=principal.kind==="user"?await (await store()).me(principal):null;return Response.json({kind:principal.kind,user,tenant:principal.tenant,permissions:[...principal.permissions].sort()},{headers:{"cache-control":"no-store"}});}catch(e){return failure(e);}}
