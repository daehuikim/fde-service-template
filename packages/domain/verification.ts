// Structural verification of a discussion record (round 3, built-in reviewer "structural").
// Deterministic checks that the synthesis is internally sound before anyone acts on it:
// coverage, unresolved disputes, unsupported observations, silent reviewers and suspicious unanimity.
import type { Discussion, GoldfishFinding, ReviewerStatus, Verdict, VerificationFinding } from "../contracts/discussion";

export function structuralAudit(d: Omit<Discussion, "verification">): GoldfishFinding[] {
  const s = d.synthesis, out: GoldfishFinding[] = [];
  const add = (severity: GoldfishFinding["severity"], scope: string, finding: string, recommendation: string) => out.push({ severity, scope, finding, recommendation });
  if (d.positions.length < 2) add("blocker", "검토 범위", `탐색을 마친 관점이 ${d.positions.length}개뿐이라 교차 검토가 성립하지 않습니다.`, "실패한 관점을 다시 실행하거나 관점을 추가해 최소 2개가 탐색하게 하세요.");
  for (const f of d.failures) add("major", `${f.lens} · ${f.round}라운드`, `${f.lens} 관점이 ${f.round}라운드에서 결과를 내지 못했습니다(${f.error}). 종합은 이 관점 없이 만들어졌습니다.`, "이 관점을 다시 실행하기 전에는 해당 관점의 판단이 필요한 결론을 확정하지 마세요.");
  const resolvable = new Set(d.positions.flatMap(p => p.nextChecks.flatMap(n => n.resolves)));
  for (const c of s.contested) if (!resolvable.has(c.claim.id)) add("major", c.claim.id, "쟁점인데 이 주장을 판별할 확인 항목이 없습니다. 토론만으로는 결론이 나지 않습니다.", "작성 관점에 이 주장을 참/거짓으로 가를 가장 싼 확인을 요청하세요.");
  for (const p of d.positions) for (const c of p.claims) {
    if (c.kind === "observation" && !c.evidence) add("major", c.id, "관측(observation)으로 표시됐지만 근거가 적혀 있지 않습니다.", "근거(자료 위치, 문제 패킷의 문장)를 붙이거나 kind를 hypothesis/assumption으로 낮추세요.");
    else if (c.kind === "hypothesis" && c.confidence > 0.7 && !c.evidence) add("nit", c.id, `근거 없이 확신 ${Math.round(c.confidence * 100)}%인 가설입니다.`, "확신도를 낮추거나 근거를 붙이세요.");
  }
  const failed2 = new Set(d.failures.filter(f => f.round === 2).map(f => f.lens));
  const reviewers = new Set(d.reviews.map(r => r.lens));
  if (d.positions.length > 1) for (const p of d.positions) if (!reviewers.has(p.lens) && !failed2.has(p.lens)) add("major", p.lens, `${p.lens} 관점이 다른 관점의 주장에 의견을 하나도 내지 않았습니다. 이 침묵을 동의로 읽으면 안 됩니다.`, "이 관점의 2라운드를 다시 실행하거나, 보고서에 '검토 의견 없음'으로 명시하세요.");
  if (!s.actions.length) add("major", "우선 확인할 일", "다음 확인 항목이 없습니다. 쟁점과 가설을 판별할 수단이 없습니다.", "관점별로 가장 싼 확인을 하나 이상 받으세요.");
  for (const a of s.actions) if (!a.resolves.length) add("nit", a.id, "어떤 주장도 판별하지 않는 확인 항목입니다. 왜 필요한지 추적되지 않습니다.", "resolves에 판별 대상 주장을 연결하세요.");
  if (s.contested.length === 0 && s.consensus.length >= 3) add("nit", "합의", `반대 의견 없이 합의가 ${s.consensus.length}건입니다. 같은 모델·같은 패킷에서 나온 동조일 수 있습니다.`, "합의를 사실로 쓰기 전에 상위 합의 1~2건을 현장 자료로 확인하세요.");
  return out;
}

export function verdictOf(reviewers: ReviewerStatus[], findings: VerificationFinding[]): Verdict {
  if (findings.some(f => f.severity === "blocker")) return "blocked";
  if (reviewers.some(r => r.status === "not_run")) return "incomplete";
  if (findings.some(f => f.severity === "major")) return "attention";
  return "pass";
}
