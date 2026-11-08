// Forward-only SQL migrations. Each file runs once, inside its own transaction, under an advisory lock.
// A changed file that already ran fails the run: write a new numbered file instead (expand → backfill → contract).
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {db} from "./index";
const dir="packages/db/migrations";
const files=readdirSync(dir).filter(f=>/^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
if(new Set(files.map(f=>f.slice(0,3))).size!==files.length) throw new Error("duplicate migration version");
const sql=db();
try{
 await sql.unsafe("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, name text NOT NULL, checksum text NOT NULL CHECK (length(checksum)=64), applied_at timestamptz NOT NULL DEFAULT now())");
 const applied=new Map<string,string>((await sql.unsafe("select version, checksum from schema_migrations") as unknown as {version:string;checksum:string}[]).map(r=>[r.version,r.checksum]));
 let ran=0;
 for(const file of files){
  const version=file.slice(0,3),body=readFileSync(`${dir}/${file}`,"utf8"),checksum=createHash("sha256").update(body).digest("hex");
  const previous=applied.get(version);
  if(previous===checksum) continue;
  if(previous!==undefined) throw new Error(`migration ${file} changed after it was applied; add a new migration`);
  await sql.begin(async tx=>{
   await tx.unsafe("select pg_advisory_xact_lock(761221)");
   await tx.unsafe(body);
   await tx.unsafe("insert into schema_migrations(version,name,checksum) values($1,$2,$3)",[version,file,checksum]);
  });
  ran++;
 }
 console.log(`migration: pass (${ran} applied, ${files.length-ran} already current)`);
}finally{await sql.end();}
