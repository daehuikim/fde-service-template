import {readFileSync,writeFileSync} from "node:fs";
const s=JSON.parse(readFileSync("packages/contracts/request.schema.json"));
const fields=Object.entries(s.properties).map(([k,v])=>`  ${k}${s.required.includes(k)?"":"?"}: ${v.enum?v.enum.map(x=>JSON.stringify(x)).join(" | "):v.type==="integer"?"number":v.type};`);
const code="// Generated from request.schema.json. Run pnpm contracts.\nexport interface RequestRow {\n"+fields.join("\n")+"\n}\n";
const path="packages/contracts/request.generated.ts";if(process.argv.includes("--check")){if(readFileSync(path,"utf8")!==code)throw Error("stale generated contracts");console.log("pass: generated request type matches schema");}else writeFileSync(path,code);
