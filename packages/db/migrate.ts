import {readFileSync} from "node:fs";
import {db} from "./index";
const sql=db(); try {await sql.begin(async tx=>{await tx.unsafe("select pg_advisory_xact_lock(761221)");await tx.unsafe(readFileSync("packages/db/migrations/001_runs.sql","utf8"));});console.log("migration: pass");} finally {await sql.end();}
