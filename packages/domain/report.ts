// Formats a discussion record (without its verification) as the Markdown report goldfish reviewers read.
// Pure formatting of the skill's own content: the same record always yields the same text, so its SHA-256 pins
// exactly which report the goldfish reviewed.
import type { Transcript } from "../contracts/discussion";
import { actionViews, claimViews, type ClaimView } from "./discussion";

const kind = { observation: "관측", hypothesis: "가설", assumption: "가정", vendor_claim: "업체 주장" } as const;
const cost = { low: "낮음", medium: "중간", high: "높음" } as const;
const pct = (n: number) => Math.round(n * 100) + "%";

function claimLine(c: ClaimView): string {
  const lines = [`- \`${c.claim.id}\` ${c.claim.statement} (${kind[c.claim.kind]}, 확신 ${pct(c.claim.confidence)}, 작성 ${c.author})`];
  if (c.claim.evidence) lines.push(`  - 근거: ${c.claim.evidence}`);
  if (c.note) lines.push(`  - 종합 메모: ${c.note}`);
  if (c.supporters.length) lines.push(`  - 지지: ${c.supporters.map(r => r.lens).join(", ")}`);
  for (const r of c.challenges) lines.push(`  - 반대(${r.lens}): ${r.note}`);
  for (const r of c.refinements) lines.push(`  - 보완(${r.lens}): ${r.note}`);
  return lines.join("\n");
}

export function renderReport(t: Omit<Transcript, "verification">): string {
  const claims = claimViews(t), actions = actionViews(t), s = t.synthesis, out: string[] = [];
  const group = (status: ClaimView["status"]) => { const g = claims.filter(c => c.status === status); return g.length ? g.map(claimLine) : ["- 없음"]; };
  out.push(`# 멀티 에이전트 검토: ${t.problem.title}`, "", "## 문제", "", t.problem.statement, ...(t.problem.context ? ["", `맥락: ${t.problem.context}`] : []), "");
  out.push("## 검토 범위", "", `관점: ${t.lenses.join(", ")}`, `탐색 ${t.positions.length}/${t.lenses.length} · 교차 검토 참여 ${new Set(t.reviews.map(r => r.lens)).size} · 실패 ${t.failures.length ? t.failures.map(f => `${f.lens}(${f.round}라운드, ${f.error})`).join(", ") : "없음"}`, "");
  out.push("## 한 줄 결론", "", s.headline, "");
  out.push("## 우선 확인할 일", "", ...(actions.length ? actions.map(a => `${a.rank}. \`${a.id}\` ${a.action} (제안 ${a.lens}, 판별 대상 ${a.resolves.length ? a.resolves.map(r => "`" + r + "`").join(", ") : "없음"}, 비용 ${cost[a.cost]})\n   - 이유: ${a.rationale}`) : ["- 없음"]), "");
  out.push("## 쟁점", "", ...group("contested"), "", "## 합의 (여러 관점의 같은 추정이며 사실 확인이 아님)", "", ...group("consensus"), "", "## 단일 관점", "", ...group("single_source"), "");
  if (s.questions.length) out.push("## 열린 질문", "", ...s.questions.map(q => `- ${q}`), "");
  if (s.risks.length) out.push("## 위험", "", ...s.risks.map(q => `- ${q}`), "");
  return out.join("\n");
}
