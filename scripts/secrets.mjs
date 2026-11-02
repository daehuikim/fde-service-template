import {execFileSync,spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
const files=execFileSync("git",["ls-files","-z"]).toString().split("\0").filter(Boolean);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/AKIA[0-9A-Z]{16}/];let failed=false;
for(const file of files){const body=readFileSync(file,"utf8");if(patterns.some(p=>p.test(body))){console.error(`potential secret: ${file}`);failed=true;}}
console.log(`basic tracked-file scan: ${failed?"fail":"pass"}; ${files.length} files. This is not a gitleaks history scan.`);
const result=spawnSync("gitleaks",["git","--redact","--no-banner"],{stdio:"inherit"});if(result.error){console.error("blocked: gitleaks unavailable; history scan not run");process.exitCode=2;}else process.exitCode=failed?1:result.status??1;
