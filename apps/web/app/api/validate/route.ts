import {validateCsv} from "../../../../../packages/tools";
import {guard,readBody,failure} from "../guard";
export async function POST(req:Request){try{guard(req);const b=await readBody(req);if(Object.keys(b).join()!=="csv"||typeof b.csv!=="string")throw new Error("invalid_input");const r=validateCsv(b.csv,req.signal);r.mode=process.env.APP_MODE==="live"?"live":"fixture";return Response.json(r);}catch(e){return failure(e);}}
