"use client";
// Sign-in panel for the sidebar. The server decides every permission; this UI only hides what the user cannot do.
import {useEffect,useState} from "react";
import {Button} from "./ui/button";
type Me={kind:string;user:{email:string;displayName:string}|null;tenant:string;permissions:string[]};
export function SessionPanel(){
 const [me,setMe]=useState<Me|null>(null),[email,setEmail]=useState("owner@example.com"),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[note,setNote]=useState("");
 async function refresh(){const r=await fetch("/api/auth/me",{cache:"no-store"});setMe(r.ok?await r.json():null);}
 useEffect(()=>{refresh().catch(()=>setMe(null));},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setNote("");try{const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);setPassword("");await refresh();}catch(err){setNote(err instanceof Error&&err.message==="too_many_attempts"?"시도 횟수를 초과했습니다. 15분 후 다시 시도하세요.":"이메일 또는 비밀번호를 확인하세요.");}finally{setBusy(false);}}
 async function logout(){setBusy(true);try{await fetch("/api/auth/logout",{method:"POST"});await refresh();}finally{setBusy(false);}}
 if(me?.user) return <div className="session"><div className="nav-label">SIGNED IN</div><p className="session-user">{me.user.displayName}<br/><small>{me.user.email} · {me.tenant}</small></p><p className="session-perms">{me.permissions.length}개 권한 · {me.permissions.includes("work_item:create")?"편집 가능":"읽기 전용"}</p><Button disabled={busy} onClick={logout}>로그아웃</Button></div>;
 return <form className="session" onSubmit={login}><div className="nav-label">SIGN IN</div><label htmlFor="email">이메일</label><input id="email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} required/><label htmlFor="password">비밀번호</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} required/><Button className="primary" type="submit" disabled={busy||!password}>{busy?"확인 중…":"로그인"}</Button>{note&&<p role="alert" className="session-note">{note}</p>}<p className="session-note">데모 계정: owner / viewer@example.com</p></form>;
}
