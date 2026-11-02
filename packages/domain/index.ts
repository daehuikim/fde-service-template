import { validateRow, type Issue, type RequestRow } from "../contracts";
export function inspect(rows: unknown[]): Issue[] {
 const issues: Issue[] = []; const seen = new Set<string>();
 rows.forEach((row,index)=>{ const n=index+2;
  if (!validateRow(row)) { for(const e of validateRow.errors ?? []) issues.push({row:n,field:e.instancePath.slice(1)||String(e.params.missingProperty ?? e.params.additionalProperty ?? "row"),code:"schema",message:({required:"필수 값을 입력해 주세요.",type:"값의 형식을 확인해 주세요.",enum:"허용된 값 중에서 선택해 주세요.",minimum:"허용된 최솟값보다 작습니다.",maximum:"허용된 최댓값을 초과했습니다.",minLength:"값을 입력해 주세요.",maxLength:"허용된 길이를 초과했습니다.",pattern:"요청 번호 형식을 확인해 주세요.",additionalProperties:"허용되지 않은 필드가 있습니다."} as Record<string,string>)[e.keyword] ?? "입력 계약을 확인해 주세요."}); return; }
  const r=row as RequestRow;
  if(seen.has(r.request_id)) issues.push({row:n,field:"request_id",code:"duplicate",message:"같은 요청 번호가 있습니다."});
  seen.add(r.request_id);
  if(!r.title.trim()) issues.push({row:n,field:"title",code:"blank",message:"제목을 입력해 주세요."});
  if(r.department==="finance" && r.amount===0) issues.push({row:n,field:"amount",code:"finance_amount",message:"재무 요청은 금액이 0보다 커야 합니다."});
 }); return issues;
}
export type RunState = "draft"|"validating"|"review"|"saved"|"cancelled";
export function transition(from:RunState,to:RunState):RunState {
 const allowed:Record<RunState,RunState[]>={draft:["validating"],validating:["review","cancelled"],review:["validating","saved"],saved:[],cancelled:["validating"]};
 if(!allowed[from].includes(to)) throw new Error("invalid_transition"); return to;
}
