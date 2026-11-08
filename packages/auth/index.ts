// Dependency-free authentication and authorization primitives. No I/O here: storage lives in packages/db/identity.ts.
import {randomBytes,scryptSync,timingSafeEqual,createHash} from "node:crypto";

// OWASP Password Storage Cheat Sheet (checked 2026-11-08): scrypt N=2^17, r=8, p=1 when Argon2id is unavailable.
export const scryptParams={N:131072,r:8,p:1,keyLength:32} as const;
const maxmem=256*1024*1024;
export function hashPassword(password:string):string{
 if(typeof password!=="string"||Buffer.byteLength(password)<8||Buffer.byteLength(password)>256) throw new Error("weak_password");
 const salt=randomBytes(16);
 const hash=scryptSync(password.normalize("NFKC"),salt,scryptParams.keyLength,{N:scryptParams.N,r:scryptParams.r,p:scryptParams.p,maxmem});
 return `$scrypt$ln=17,r=8,p=1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
export function verifyPassword(password:string,phc:string):boolean{
 const m=/^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(phc);
 if(!m||typeof password!=="string") return false;
 const expected=Buffer.from(m[5],"base64url");
 const actual=scryptSync(password.normalize("NFKC"),Buffer.from(m[4],"base64url"),expected.length,{N:2**Number(m[1]),r:Number(m[2]),p:Number(m[3]),maxmem});
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

// Opaque bearer secrets: 256 bits of entropy, stored only as SHA-256. The prefix lets operators identify a key without the secret.
export function newSecret(prefix=""):{secret:string;hash:string}{const secret=prefix+randomBytes(32).toString("base64url");return {secret,hash:hashSecret(secret)};}
export function hashSecret(secret:string):string{return createHash("sha256").update(secret).digest("hex");}

export const sessionPolicy={cookie:"fde_session",idleMinutes:12*60,absoluteHours:7*24,loginWindowMinutes:15,loginMaxFailures:10} as const;
export function sessionCookie(token:string|null,secure:boolean):string{
 const base=`${sessionPolicy.cookie}=${token??""}; Path=/; HttpOnly; SameSite=Lax${secure?"; Secure":""}`;
 return token?`${base}; Max-Age=${sessionPolicy.absoluteHours*3600}`:`${base}; Max-Age=0`;
}
export function readSessionCookie(req:Request):string|null{
 for(const part of (req.headers.get("cookie")??"").split(";")){const [k,...v]=part.trim().split("=");if(k===sessionPolicy.cookie&&v.length){const t=v.join("=");return /^[A-Za-z0-9_-]{40,64}$/.test(t)?t:null;}}
 return null;
}
// Cookie-authenticated mutations must come from our own origin (CSRF). Bearer clients are exempt: no ambient credential.
export function assertSameOrigin(req:Request,appOrigin:string|undefined){
 if(["GET","HEAD","OPTIONS"].includes(req.method)) return;
 const origin=req.headers.get("origin")??(req.headers.get("referer")?new URL(req.headers.get("referer")!).origin:null);
 const expected=appOrigin??new URL(req.url).origin;
 if(req.headers.get("sec-fetch-site")==="cross-site"||!origin||origin!==expected) throw new Error("csrf_rejected");
}

export type Permission=`${string}:${string}`;
export interface Principal{kind:"user"|"api_key"|"service";id:string;tenant:string;permissions:ReadonlySet<string>;sessionId?:string}
export function can(principal:Pick<Principal,"permissions">,permission:Permission):boolean{return principal.permissions.has(permission);}
export function requirePermission(principal:Pick<Principal,"permissions">,permission:Permission){if(!can(principal,permission)) throw new Error("forbidden");}

// Static view of the system roles seeded in packages/db/migrations/003_tenancy_rbac.sql; the DB is the source of truth.
export const systemRoles:Record<"owner"|"admin"|"member"|"viewer",readonly Permission[]>=(()=>{
 const all:Permission[]=["tenant:read","tenant:manage","member:read","member:invite","member:manage","role:manage","api_key:manage","workspace:read","workspace:manage","work_item:read","work_item:create","work_item:update","work_item:delete","comment:create","memory:read_shared","memory:write_shared","run:read","run:create","audit:read"];
 const member:Permission[]=["tenant:read","member:read","workspace:read","work_item:read","work_item:create","work_item:update","comment:create","memory:read_shared","memory:write_shared","run:read","run:create"];
 const viewer:Permission[]=["tenant:read","member:read","workspace:read","work_item:read","memory:read_shared","run:read"];
 return {owner:all,admin:all.filter(p=>p!=="tenant:manage"),member,viewer};
})();
export const normalizeEmail=(email:unknown)=>typeof email==="string"&&email.length<=254&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)?email.trim().toLowerCase():null;
