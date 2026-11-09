// Round 3 · Elephant-Goldfish verification.
// The orchestrator that ran the discussion holds all of its context (the "elephant"). Goldfish reviewers get only the
// rendered report and the problem packet — no transcript, no agent conversation — so they read it the way a
// person new to the problem would, and catch what the context-holder no longer sees.
// Pattern adapted from google/elephant-goldfish-model (Apache-2.0); prompts and rules here are this project's own.
import { createHash } from "node:crypto";
import { isGoldfishFinding, type Discussion, type GoldfishFinding, type HostVerification, type Problem, type ReviewerStatus, type Verification, type VerificationFinding } from "../contracts/discussion";
import { renderReport, glossary } from "../domain/report";
import { structuralAudit, verdictOf } from "../domain/verification";
import { AgentFailure, bounded } from "./bounded";
import { builtInReviewers } from "./reviewers";

export interface GoldfishPacket { problem: Problem; document: string }
export interface GoldfishReviewer { id: string; title: string; focus: string; review(packet: GoldfishPacket, signal: AbortSignal): Promise<GoldfishFinding[]> }
export type GoldfishEvent = { type: "goldfish"; reviewer: string; state: "running" | "retrying" } | { type: "goldfish"; reviewer: string; state: "done"; findings: number } | { type: "goldfish"; reviewer: string; state: "not_run" };

export { builtInReviewers };

const section = (doc: string, heading: string) => { const i = doc.indexOf(`\n## ${heading}`); if (i < 0) return null; const rest = doc.slice(i + 4 + heading.length); const j = rest.indexOf("\n## "); return (j < 0 ? rest : rest.slice(0, j)).trim(); };

export const comprehensionGoldfish: GoldfishReviewer = {
  id: "comprehension", title: builtInReviewers[1].title, focus: builtInReviewers[1].focus,
  async review({ document }) {
    const out: GoldfishFinding[] = [];
    const conclusion = section(document, "한 줄 결론"), first = section(document, "우선 확인할 일")?.split("\n")[0];
    if (!conclusion || !first || /^-\s*없음/.test(first)) out.push({ severity: "blocker", scope: "한 줄 결론 · 우선 확인할 일", finding: "보고서만 읽고는 결론과 가장 먼저 할 조치를 다시 말할 수 없습니다.", recommendation: "결론 한 문장과 첫 확인 항목을 보고서 앞부분에 쓰세요." });
    const defined = new Set([...(section(document, "용어") ?? "").matchAll(/^- ([A-Z][A-Z0-9]+):/gm)].map(m => m[1]));
    const body = document.split("\n## 용어")[0].replace(/`[^`]*`/g, " ").split("\n").filter(l => !l.startsWith("transcript SHA-256")).join("\n");
    const undefinedTerms = [...new Set([...body.matchAll(/(?<![A-Za-z])[A-Z][A-Z0-9]{1,7}(?![A-Za-z])/g)].map(m => m[0]))].filter(t => !defined.has(t) && !glossary[t]);
    if (undefinedTerms.length) out.push({ severity: undefinedTerms.length >= 3 ? "major" : "nit", scope: "용어", finding: `정의 없이 쓰인 약어: ${undefinedTerms.join(", ")}. 처음 읽는 사람은 뜻을 알 수 없습니다.`, recommendation: "문제 패킷이나 보고서 용어 절에 한 줄 정의를 추가하세요." });
    const listed = new Set([...document.matchAll(/^- `([a-z-]+\.[0-9]+)`/gm)].map(m => m[1]));
    const dangling = [...new Set([...(section(document, "우선 확인할 일") ?? "").matchAll(/`([a-z-]+\.[0-9]+)`/g)].map(m => m[1]))].filter(id => !listed.has(id));
    if (dangling.length) out.push({ severity: "major", scope: "우선 확인할 일", finding: `확인 항목이 보고서에 없는 주장을 가리킵니다: ${dangling.join(", ")}.`, recommendation: "가리키는 주장을 보고서에 포함하거나 참조를 고치세요." });
    return out;
  },
};

// Conditions in the problem text that a given lens is responsible for.
const expectations: { when: RegExp; lens: string; condition: string; severity: "major" | "nit" }[] = [
  { when: /폐쇄망|반출|사외|air.?gap|외부\s*AI/i, lens: "security", condition: "데이터 반출 제약", severity: "major" },
  { when: /폐쇄망|air.?gap|설치|배포|서버|프록시|proxy/i, lens: "target-env", condition: "현장 설치·배포 환경", severity: "major" },
  { when: /\bML\b|\bAI\b|\bVM\b|가상\s*계측|예측\s*모델|모델\s*(?:학습|기반)/, lens: "validation", condition: "모델 성능 주장", severity: "major" },
  { when: /수율|yield|손실|다운타임|downtime|비용/i, lens: "cost", condition: "손실·비용 규모", severity: "nit" },
  { when: /fleet|[0-9]+\s*대\s*중|전체\s*(?:장비|라인)|확장/i, lens: "compat-scale", condition: "여러 장비·라인으로의 확장", severity: "nit" },
];
export const zoomOutGoldfish: GoldfishReviewer = {
  id: "zoom-out", title: builtInReviewers[2].title, focus: builtInReviewers[2].focus,
  async review({ problem, document }) {
    const scope = /^관점: (.*)$/m.exec(document)?.[1].split(",").map(s => s.trim()) ?? [];
    const text = `${problem.title}\n${problem.statement}\n${problem.context ?? ""}`;
    return expectations.filter(e => e.when.test(text) && !scope.includes(e.lens)).map(e => ({ severity: e.severity, scope: "검토 범위", finding: `문제에 '${e.condition}' 조건이 있는데 이를 다룰 ${e.lens} 관점이 검토에 없습니다.`, recommendation: `${e.lens} 관점을 추가해 다시 실행하거나, 제외한 이유를 보고서에 남기세요.` }));
  },
};
export const defaultGoldfish: GoldfishReviewer[] = [comprehensionGoldfish, zoomOutGoldfish];

export interface VerifyOptions { reviewers?: GoldfishReviewer[]; host?: HostVerification; signal?: AbortSignal; timeoutMs?: number; onEvent?: (e: GoldfishEvent) => void }

export async function verifyDiscussion(base: Omit<Discussion, "verification">, options: VerifyOptions = {}): Promise<Verification> {
  const outer = options.signal ?? new AbortController().signal, ms = options.timeoutMs ?? 20000, emit = options.onEvent ?? (() => {});
  const document = renderReport(base), packet: GoldfishPacket = { problem: base.problem, document };
  const results: { status: ReviewerStatus; findings: GoldfishFinding[] }[] = [];

  emit({ type: "goldfish", reviewer: "structural", state: "running" });
  const structural = structuralAudit(base);
  results.push({ status: { reviewer: "structural", source: "built-in", status: "completed", attempts: 1, findings: structural.length }, findings: structural });
  emit({ type: "goldfish", reviewer: "structural", state: "done", findings: structural.length });

  // Goldfish run in parallel. A reviewer that fails or returns invalid output is retried once; if it fails again it is
  // "not_run" — never counted as a reviewer that found nothing.
  const goldfish = await Promise.all((options.reviewers ?? defaultGoldfish).map(async g => {
    emit({ type: "goldfish", reviewer: g.id, state: "running" });
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const out = await bounded(signal => g.review(structuredClone(packet), signal), outer, ms);
        if (!Array.isArray(out) || !out.every(isGoldfishFinding)) throw new AgentFailure("invalid_output");
        emit({ type: "goldfish", reviewer: g.id, state: "done", findings: out.length });
        return { status: { reviewer: g.id, source: "built-in" as const, status: "completed" as const, attempts: attempt, findings: out.length }, findings: out };
      } catch (e) {
        if (outer.aborted || (e instanceof AgentFailure && e.code === "cancelled")) break;
        if (attempt === 1) emit({ type: "goldfish", reviewer: g.id, state: "retrying" });
      }
    }
    emit({ type: "goldfish", reviewer: g.id, state: "not_run" });
    return { status: { reviewer: g.id, source: "built-in" as const, status: "not_run" as const, attempts: 2, findings: 0 }, findings: [] };
  }));
  if (outer.aborted) throw new Error("cancelled");
  results.push(...goldfish);
  const builtIn = new Set<string>(builtInReviewers.map(r => r.id));
  for (const h of options.host?.reviewers ?? []) results.push({ status: { reviewer: builtIn.has(h.reviewer) ? `host-${h.reviewer}` : h.reviewer, source: "host", status: h.status, attempts: 1, findings: h.status === "completed" ? h.findings.length : 0 }, findings: h.status === "completed" ? h.findings : [] });

  const rank = { blocker: 0, major: 1, nit: 2 } as const;
  const findings: VerificationFinding[] = results.flatMap(r => r.findings.map((f, i) => ({ id: `${r.status.reviewer}.f${i + 1}`, reviewer: r.status.reviewer, ...f })))
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
  const reviewers = results.map(r => r.status);
  return { verdict: verdictOf(reviewers, findings), documentHash: createHash("sha256").update(document).digest("hex"), reviewers, findings };
}
