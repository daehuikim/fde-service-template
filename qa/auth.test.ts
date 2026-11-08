import {describe,it,expect} from "vitest";
import {hashPassword,verifyPassword,newSecret,hashSecret,sessionCookie,assertSameOrigin,can,systemRoles} from "../packages/auth";
import {POST as login} from "../apps/web/app/api/auth/login/route";
import {POST as logout} from "../apps/web/app/api/auth/logout/route";
import {GET as me} from "../apps/web/app/api/auth/me/route";
import {GET as listItems,POST as createItem,PATCH as patchItem} from "../apps/web/app/api/work-items/route";
import {GET as listMemory,PUT as putMemory} from "../apps/web/app/api/memory/route";
const origin="http://localhost";
function req(path:string,method:string,body?:unknown,headers:Record<string,string>={}){return new Request(origin+path,{method,headers:{"content-type":"application/json",origin,...headers},body:body===undefined?undefined:JSON.stringify(body)});}
async function signIn(email:string,password:string){const r=await login(req("/api/auth/login","POST",{email,password}));const cookie=r.headers.get("set-cookie")?.split(";")[0]??"";return {r,cookie};}
describe("password hashing",()=>{
 it("uses scrypt with OWASP parameters and verifies in constant shape",()=>{const phc=hashPassword("correct horse battery");expect(phc.startsWith("$scrypt$ln=17,r=8,p=1$")).toBe(true);expect(verifyPassword("correct horse battery",phc)).toBe(true);expect(verifyPassword("wrong",phc)).toBe(false);expect(verifyPassword("x","not-a-hash")).toBe(false);});
 it("rejects short passwords and never repeats a salt",()=>{expect(()=>hashPassword("short")).toThrow("weak_password");expect(hashPassword("long enough 1")).not.toBe(hashPassword("long enough 1"));});
});
describe("tokens, cookies and CSRF",()=>{
 it("stores only hashes of 256-bit secrets",()=>{const {secret,hash}=newSecret("fdek_");expect(secret.startsWith("fdek_")).toBe(true);expect(hash).toMatch(/^[0-9a-f]{64}$/);expect(hashSecret(secret)).toBe(hash);});
 it("emits HttpOnly SameSite cookies and clears them on logout",()=>{expect(sessionCookie("abc",true)).toBe("fde_session=abc; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800");expect(sessionCookie(null,false)).toContain("Max-Age=0");});
 it("rejects cross-site mutations and accepts same-origin or safe methods",()=>{expect(()=>assertSameOrigin(new Request(origin+"/x",{method:"POST",headers:{origin:"https://evil.example"}}),origin)).toThrow("csrf_rejected");expect(()=>assertSameOrigin(new Request(origin+"/x",{method:"POST"}),origin)).toThrow("csrf_rejected");expect(()=>assertSameOrigin(new Request(origin+"/x",{method:"POST",headers:{origin}}),origin)).not.toThrow();expect(()=>assertSameOrigin(new Request("https://evil.example/x",{method:"GET"}),origin)).not.toThrow();});
});
describe("RBAC matrix",()=>{
 it("keeps viewer read-only and reserves tenant:manage for owner",()=>{const viewer={permissions:new Set(systemRoles.viewer)};expect(can(viewer,"work_item:read")).toBe(true);expect(can(viewer,"work_item:create")).toBe(false);expect(systemRoles.admin).not.toContain("tenant:manage");expect(systemRoles.owner).toContain("tenant:manage");});
});
describe("session API in fixture mode",()=>{
 it("rejects bad credentials, unknown fields and cross-site logins",async()=>{expect((await login(req("/api/auth/login","POST",{email:"owner@example.com",password:"nope"}))).status).toBe(401);expect((await login(req("/api/auth/login","POST",{email:"owner@example.com",password:"demo-owner-password",admin:true}))).status).toBe(400);expect((await login(req("/api/auth/login","POST",{email:"owner@example.com",password:"demo-owner-password"},{origin:"https://evil.example"}))).status).toBe(403);expect((await login(req("/api/auth/login","POST",{email:"not-an-email",password:"demo-owner-password"}))).status).toBe(400);});
 it("logs in, resolves the session from the cookie, and logs out",async()=>{const {r,cookie}=await signIn("owner@example.com","demo-owner-password");expect(r.status).toBe(200);expect(r.headers.get("set-cookie")).toContain("HttpOnly");const body=await r.json();expect(body.tenant).toBe("demo");expect(body.permissions).toContain("tenant:manage");
  const who=await me(req("/api/auth/me","GET",undefined,{cookie}));expect(who.status).toBe(200);expect((await who.json()).user.email).toBe("owner@example.com");
  expect((await logout(req("/api/auth/logout","POST",undefined,{cookie}))).status).toBe(204);expect((await me(req("/api/auth/me","GET",undefined,{cookie}))).status).toBe(401);});
 it("rejects a forged cookie",async()=>{expect((await me(req("/api/auth/me","GET",undefined,{cookie:"fde_session="+"a".repeat(43)}))).status).toBe(401);});
 it("enforces permissions and optimistic concurrency on work items",async()=>{
  const owner=(await signIn("owner@example.com","demo-owner-password")).cookie,viewer=(await signIn("viewer@example.com","demo-viewer-password")).cookie;
  const created=await createItem(req("/api/work-items","POST",{title:"현장 점검"},{cookie:owner}));expect(created.status).toBe(201);const item=await created.json();expect(item.version).toBe(1);
  expect((await createItem(req("/api/work-items","POST",{title:"금지"},{cookie:viewer}))).status).toBe(403);
  const seen=await listItems(req("/api/work-items","GET",undefined,{cookie:viewer}));expect(seen.status).toBe(200);expect((await seen.json()).items.map((i:{id:string})=>i.id)).toContain(item.id);
  expect((await patchItem(req("/api/work-items","PATCH",{id:item.id,version:1,status:"done"},{cookie:owner}))).status).toBe(200);
  expect((await patchItem(req("/api/work-items","PATCH",{id:item.id,version:1,status:"open"},{cookie:owner}))).status).toBe(409);
  expect((await patchItem(req("/api/work-items","PATCH",{id:item.id,version:2,status:"bogus"},{cookie:owner}))).status).toBe(400);
  expect((await createItem(req("/api/work-items","POST",{title:"x",tenant:"victim"},{cookie:owner}))).status).toBe(400);});
 it("keeps private memory per user and gates shared memory by permission",async()=>{
  const owner=(await signIn("owner@example.com","demo-owner-password")).cookie,viewer=(await signIn("viewer@example.com","demo-viewer-password")).cookie;
  expect((await putMemory(req("/api/memory","PUT",{key:"draft",value:{note:"비공개"}},{cookie:owner}))).status).toBe(200);
  expect((await putMemory(req("/api/memory","PUT",{key:"shared",value:1,visibility:"tenant"},{cookie:owner}))).status).toBe(200);
  expect((await putMemory(req("/api/memory","PUT",{key:"shared2",value:1,visibility:"tenant"},{cookie:viewer}))).status).toBe(403);
  expect((await putMemory(req("/api/memory","PUT",{key:"../etc",value:1},{cookie:owner}))).status).toBe(400);
  const keys=(await (await listMemory(req("/api/memory","GET",undefined,{cookie:viewer}))).json()).entries.map((e:{key:string})=>e.key);expect(keys).toContain("shared");expect(keys).not.toContain("draft");});
 it("service clients cannot use per-user memory",async()=>{expect((await listMemory(req("/api/memory","GET"))).status).toBe(403);});
 it("locks an account after repeated failures",async()=>{for(let i=0;i<10;i++)await login(req("/api/auth/login","POST",{email:"viewer@example.com",password:"wrong-"+i}));expect((await login(req("/api/auth/login","POST",{email:"viewer@example.com",password:"demo-viewer-password"}))).status).toBe(429);});
});
