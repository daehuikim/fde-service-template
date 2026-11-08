// Shared navigation for the example workspaces.
import {SessionPanel} from "./session-panel";
const items=[{href:"/",label:"운영 요청 검증",key:"validate"},{href:"/discussion",label:"멀티 에이전트 토론",key:"discussion"}] as const;
export function Sidebar({active}:{active:(typeof items)[number]["key"]}){
 return <aside><a className="brand" href="/">f<span>de</span><small>SERVICE TOOLKIT</small></a><div className="nav-label">WORKSPACE</div><nav className="nav">{items.map((it,i)=><a key={it.key} href={it.href} className={"nav-item"+(it.key===active?" active":"")} aria-current={it.key===active?"page":undefined}>{it.label} <span>{String(i+1).padStart(2,"0")}</span></a>)}</nav><SessionPanel/><div className="aside-bottom">모든 데이터는 합성 예제입니다.<br/>외부 AI로 전송하지 않습니다.</div></aside>;
}
