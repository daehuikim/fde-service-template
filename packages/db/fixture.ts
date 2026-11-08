// In-memory store for APP_MODE=fixture: same contract and same permission rules, no durability, blocked in production.
import {randomUUID} from "node:crypto";
import {hashPassword,verifyPassword,newSecret,hashSecret,systemRoles,sessionPolicy,type Principal} from "../auth";
import type {Store,User,WorkItem,MemoryEntry} from "./store";
export const fixtureAccounts={tenant:"demo",users:[{email:"owner@example.com",password:"demo-owner-password",displayName:"데모 소유자",role:"owner" as const},{email:"viewer@example.com",password:"demo-viewer-password",displayName:"데모 열람자",role:"viewer" as const}]};
export function createFixtureStore():Store{
 const users=new Map<string,User&{phc:string}>(),members=new Map<string,Set<string>>(),sessions=new Map<string,{user:string;tenant:string;expires:number}>(),workspaces=new Map<string,{id:string;tenant:string;key:string}>(),items=new Map<string,WorkItem&{tenant:string}>(),memory=new Map<string,MemoryEntry&{tenant:string;user:string}>(),failures=new Map<string,number[]>();
 const perms=(tenant:string,user:string)=>new Set([...(members.get(`${tenant}/${user}`)??[])].flatMap(r=>systemRoles[r as keyof typeof systemRoles]));
 const store:Store={
  async createTenant(){},
  async createUser({email,password,displayName}){if([...users.values()].some(u=>u.email===email)) throw new Error("email_taken");const u={id:randomUUID(),email,displayName,phc:hashPassword(password)};users.set(u.id,u);return {id:u.id,email,displayName};},
  async addMember(tenant,userId,role){const k=`${tenant}/${userId}`;members.set(k,new Set([...(members.get(k)??[]),role]));},
  async login({email,password,tenant}){
   const recent=(failures.get(email)??[]).filter(t=>t>Date.now()-sessionPolicy.loginWindowMinutes*60000);failures.set(email,recent);
   if(recent.length>=sessionPolicy.loginMaxFailures) throw new Error("too_many_attempts");
   const u=[...users.values()].find(x=>x.email===email);
   if(!u||!verifyPassword(password,u.phc)){recent.push(Date.now());throw new Error("unauthorized");}
   const mine=[...members.keys()].filter(k=>k.endsWith("/"+u.id)).map(k=>k.split("/")[0]);const active=tenant??mine[0];
   if(!active||!mine.includes(active)) throw new Error("no_membership");
   const {secret,hash}=newSecret();sessions.set(hash,{user:u.id,tenant:active,expires:Date.now()+sessionPolicy.absoluteHours*3600000});
   return {token:secret,user:{id:u.id,email:u.email,displayName:u.displayName},tenant:active};
  },
  async resolveSession(token){const s=sessions.get(hashSecret(token));if(!s||s.expires<Date.now()) return null;return {kind:"user",id:s.user,tenant:s.tenant,sessionId:hashSecret(token).slice(0,16),permissions:perms(s.tenant,s.user)};},
  async revokeSession(token){sessions.delete(hashSecret(token));},
  async me(p){const u=users.get(p.id);return u?{id:u.id,email:u.email,displayName:u.displayName}:null;},
  async ensureWorkspace(p,key){const k=`${p.tenant}/${key}`;const w=workspaces.get(k)??{id:randomUUID(),tenant:p.tenant,key};workspaces.set(k,w);return w.id;},
  async createWorkItem(p,input){if(![...workspaces.values()].some(w=>w.id===input.workspaceId&&w.tenant===p.tenant)) throw new Error("not_found");if(!input.title||input.title.length>200) throw new Error("invalid_input");const w={id:randomUUID(),tenant:p.tenant,title:input.title,status:"open",priority:input.priority??3,version:1,workspace_id:input.workspaceId,updated_at:new Date().toISOString()};items.set(w.id,w);return strip(w);},
  async updateWorkItem(p,id,expectedVersion,patch){const w=items.get(id);if(!w||w.tenant!==p.tenant) throw new Error("not_found");if(w.version!==expectedVersion) throw new Error("version_conflict");Object.assign(w,{title:patch.title??w.title,status:patch.status??w.status,priority:patch.priority??w.priority,version:w.version+1,updated_at:new Date().toISOString()});return strip(w);},
  async listWorkItems(p,workspaceId,limit=50){return [...items.values()].filter(w=>w.tenant===p.tenant&&w.workspace_id===workspaceId).slice(0,limit).map(strip);},
  async upsertMemory(p,e){if(p.kind!=="user") throw new Error("forbidden");const k=`${p.tenant}/${p.id}/${e.workspaceId??""}/${e.key}`;const m={tenant:p.tenant,user:p.id,key:e.key,value:e.value,visibility:e.visibility??"private" as const,workspace_id:e.workspaceId??null,updated_at:new Date().toISOString()};memory.set(k,m);return stripMemory(m);},
  async listMemory(p,workspaceId){return [...memory.values()].filter(m=>m.tenant===p.tenant&&m.workspace_id===(workspaceId??null)&&(m.user===p.id||m.visibility!=="private")).map(stripMemory);},
 };
 return store;
}
const strip=({tenant:_t,...w}:WorkItem&{tenant:string}):WorkItem=>w;
const stripMemory=({tenant:_t,user:_u,...m}:MemoryEntry&{tenant:string;user:string}):MemoryEntry=>m;
let seeded:Promise<Store>|undefined;
export function fixtureStore():Promise<Store>{return seeded??=(async()=>{const s=createFixtureStore();for(const a of fixtureAccounts.users){const u=await s.createUser(a);await s.addMember(fixtureAccounts.tenant,u.id,a.role);}return s;})();}
