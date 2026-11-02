export function GET(){return Response.json({status:"ok",mode:process.env.APP_MODE??"fixture",version:"0.1.0"});}
