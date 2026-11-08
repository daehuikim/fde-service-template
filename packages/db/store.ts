// Storage contract shared by the PostgreSQL store (live) and the in-memory fixture store (demo/tests).
import type {Principal} from "../auth";
export interface User{id:string;email:string;displayName:string}
export interface WorkItem{id:string;title:string;status:string;priority:number;version:number;workspace_id:string;updated_at:string|Date}
export interface MemoryEntry{key:string;value:unknown;visibility:"private"|"workspace"|"tenant";workspace_id:string|null;updated_at:string|Date}
export interface LoginInput{email:string;password:string;tenant?:string}
export interface Store{
 createTenant(id:string,name:string):Promise<void>;
 createUser(input:{email:string;password:string;displayName:string}):Promise<User>;
 addMember(tenant:string,userId:string,role:"owner"|"admin"|"member"|"viewer"):Promise<void>;
 login(input:LoginInput):Promise<{token:string;user:User;tenant:string}>;
 resolveSession(token:string):Promise<Principal|null>;
 revokeSession(token:string):Promise<void>;
 me(p:Principal):Promise<User|null>;
 ensureWorkspace(p:Principal,key:string,name:string):Promise<string>;
 createWorkItem(p:Principal,input:{workspaceId:string;title:string;body?:string;priority?:number}):Promise<WorkItem>;
 updateWorkItem(p:Principal,id:string,expectedVersion:number,patch:{title?:string;status?:string;priority?:number}):Promise<WorkItem>;
 listWorkItems(p:Principal,workspaceId:string,limit?:number):Promise<WorkItem[]>;
 upsertMemory(p:Principal,entry:{key:string;value:unknown;visibility?:MemoryEntry["visibility"];workspaceId?:string|null}):Promise<MemoryEntry>;
 listMemory(p:Principal,workspaceId:string|null):Promise<MemoryEntry[]>;
}
