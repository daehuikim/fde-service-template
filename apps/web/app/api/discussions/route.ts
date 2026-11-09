// Multi-agent discussion import API.
// POST {record} → JSON discussion. The record is produced by a host assistant running the fde-multi-agent-review
// skill (exploration, cross-review, synthesis and goldfish verification are all skill steps). This route only checks
// the contract, reference integrity and that the goldfish reviewed exactly this report; it runs no agent and judges nothing.
// Needs run:create.
import {readBody,failure} from "../guard";
import {authenticate,onlyKeys} from "../session";
import {requirePermission} from "../../../../../packages/auth";
import {acceptDiscussion} from "../../../../../packages/agents/record";
export async function POST(req:Request){try{
 const {principal}=await authenticate(req);requirePermission(principal,"run:create");
 const b=await readBody(req);onlyKeys(b,["record"]);
 return Response.json(acceptDiscussion(b.record),{headers:{"cache-control":"no-store"}});
}catch(e){return failure(e);}}
