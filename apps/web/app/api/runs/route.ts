import {validateCsv} from "../../../../../packages/tools";
import {saveRun} from "../../../../../packages/db";
import {guard,readBody,failure} from "../guard";
export async function POST(req:Request){try{const ctx=guard(req);const b=await readBody(req);if(typeof b.csv!=="string"||typeof b.key!=="string"||Object.keys(b).some(k=>!["csv","key"].includes(k)))throw new Error("invalid_input");const result=validateCsv(b.csv,req.signal);if(result.issues.length)throw new Error("invalid_input");if(process.env.APP_MODE!=="live") return Response.json({error:"fixture_export_only"},{status:409});result.mode="live";return Response.json(await saveRun(ctx,b.key,result));}catch(e){return failure(e);}}
