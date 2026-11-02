import {spawnSync} from "node:child_process";
const r=spawnSync("semgrep",["scan","--config","qa/semgrep.yml","--error","--metrics=off","--disable-version-check","apps/web","packages"],{stdio:"inherit"});if(r.error)console.error("blocked: install pinned semgrep CLI; static security rules not run");process.exit(r.status??2);
