// Isolated CI database only. No production credentials or destructive resets.
import postgres from 'postgres';
if(process.env.QA_DATABASE_PROVISION!=='1'||!process.env.DATABASE_ADMIN_URL)throw Error('blocked: explicit QA provisioning and admin URL required');
const sql=postgres(process.env.DATABASE_ADMIN_URL);
try{await sql.unsafe("CREATE ROLE fde_runtime LOGIN PASSWORD 'local-test-only'");await sql.unsafe('GRANT USAGE, CREATE ON SCHEMA public TO fde_runtime');console.log('QA runtime role created');}finally{await sql.end();}
