// Deterministic synthesis of a multi-agent discussion. No model call: every line of the result
// points back to a claim id and the lenses that produced, supported or challenged it.
import type { Transcript, Synthesis, SynthesizedClaim, RankedAction, Merged, LensId, ClaimStatus } from "../contracts/discussion";

const costBonus = { low: 2, medium: 1, high: 0 } as const;
const costLabel = { low: "비용 낮음", medium: "비용 중간", high: "비용 높음" } as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function synthesize(t: Transcript): Synthesis {
  const claims: SynthesizedClaim[] = t.positions.flatMap(p => p.claims.map(claim => {
    const rs = t.reviews.filter(r => r.target === claim.id);
    const supporters = rs.filter(r => r.stance === "support").map(r => r.lens);
    const challenges = rs.filter(r => r.stance === "challenge").map(({ lens, note }) => ({ lens, note }));
    const refinements = rs.filter(r => r.stance === "refine").map(({ lens, note }) => ({ lens, note }));
    const status: ClaimStatus = challenges.length ? "contested" : supporters.length ? "consensus" : "single_source";
    return { claim, author: p.lens, status, supporters, challenges, refinements, weight: round2(claim.confidence * (1 + 0.5 * supporters.length) - 0.4 * challenges.length) };
  }));
  const byWeight = (a: SynthesizedClaim, b: SynthesizedClaim) => b.weight - a.weight || a.claim.id.localeCompare(b.claim.id);
  const pick = (s: ClaimStatus) => claims.filter(c => c.status === s).sort(byWeight);
  const consensus = pick("consensus"), contested = pick("contested"), singleSource = pick("single_source");
  const status = new Map(claims.map(c => [c.claim.id, c]));

  // Settling a disagreement comes first, then confirming what several lenses already agree on (it leads to action),
  // then single-lens claims. Cheaper checks win ties.
  const actions: RankedAction[] = t.positions.flatMap(p => p.nextChecks.map(n => {
    const targets = n.resolves.map(id => status.get(id)).filter((c): c is SynthesizedClaim => !!c);
    const score = targets.reduce((s, c) => s + (c.status === "contested" ? 3 : c.status === "consensus" ? 2 : 1), 0);
    const nContested = targets.filter(c => c.status === "contested").length, nOpen = targets.filter(c => c.status === "single_source").length;
    const parts = [nContested && `쟁점 ${nContested}건 판별`, nOpen && `단일 관점 ${nOpen}건 확인`, targets.length - nContested - nOpen > 0 && `합의 ${targets.length - nContested - nOpen}건 확정`, costLabel[n.cost]].filter(Boolean);
    return { ...n, lens: p.lens, priority: score + costBonus[n.cost], rationale: parts.join(" · ") };
  })).sort((a, b) => b.priority - a.priority || costBonus[b.cost] - costBonus[a.cost] || a.id.localeCompare(b.id)).slice(0, 8);

  const reviewed = new Set(t.reviews.map(r => r.lens)).size;
  const agreement = consensus.length + contested.length ? round2(consensus.length / (consensus.length + contested.length)) : 0;
  const explored = t.positions.length;
  const lead = actions[0] ? ` 먼저 확인: ${actions[0].action}` : "";
  const headline = explored === 0
    ? "탐색을 마친 관점이 없습니다. 실패한 에이전트를 확인하고 다시 실행하세요."
    : `${t.lenses.length}개 관점 중 ${explored}개가 탐색했습니다. 합의 ${consensus.length}건 · 쟁점 ${contested.length}건 · 단일 관점 ${singleSource.length}건.${lead}`;

  return {
    headline, agreement,
    coverage: { requested: t.lenses.length, explored, reviewed, failed: t.failures },
    consensus, contested, singleSource, actions,
    questions: merge(t.positions.flatMap(p => p.questions.map(text => ({ text, lens: p.lens })))),
    risks: merge(t.positions.flatMap(p => p.risks.map(text => ({ text, lens: p.lens })))),
  };
}

function merge(items: { text: string; lens: LensId }[]): Merged[] {
  const out = new Map<string, Merged>();
  for (const { text, lens } of items) {
    const key = text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    const m = out.get(key) ?? { text: text.trim(), lenses: [] };
    if (!m.lenses.includes(lens)) m.lenses.push(lens);
    out.set(key, m);
  }
  return [...out.values()].sort((a, b) => b.lenses.length - a.lenses.length);
}
