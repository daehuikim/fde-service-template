import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {validateCsv} from "../tools";
import cases from "../../evalsets/cases.json";
const started=performance.now();
export function evaluate(){return cases.map(c=>{try{const r=validateCsv(c.csv);return {id:c.id,split:c.split,expected:c.error??c.accepted,actual:r.accepted,status:!c.error&&r.accepted===c.accepted?"pass":"fail",sourceHash:r.sourceHash,issues:r.issues};}catch(e){const error=e instanceof Error?e.message:"unknown";return {id:c.id,split:c.split,expected:c.error,actual:error,status:c.error&&(c.error==="parse_error"||error===c.error)?"pass":"fail"};}});}
const results=evaluate();let sha="uncommitted",dirty=true;try{sha=execFileSync("git",["rev-parse","HEAD"],{stdio:["ignore","pipe","ignore"]}).toString().trim();}catch{}try{dirty=!!execFileSync("git",["status","--porcelain"]).toString().trim();}catch{}
const report={createdAt:new Date().toISOString(),sha,dirty,mode:"fixture",datasetHash:createHash("sha256").update(readFileSync("evalsets/cases.json")).digest("hex"),configHash:createHash("sha256").update(readFileSync("config/policy.json")).digest("hex"),versions:{node:process.version,tools:JSON.parse(readFileSync("package.json","utf8")).dependencies},durationMs:performance.now()-started,cost:0,results,passed:results.filter(r=>r.status==="pass").length,total:results.length,humanValidation:"human_validation_pending"};
mkdirSync("reports",{recursive:true});writeFileSync("reports/fixture.json",JSON.stringify(report,null,2));console.log(`${report.passed}/${report.total} fixture cases passed; reports/fixture.json`);if(report.passed!==report.total)process.exitCode=1;
