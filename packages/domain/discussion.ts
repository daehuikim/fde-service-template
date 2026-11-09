// Read-only views over a discussion record for the report and the UI. These join what the record already says
// (claims, the synthesizer's status, recorded stances); they add no classification or ranking of their own.
import type { Claim, ClaimStatus, LensId, NextCheck, Transcript } from "../contracts/discussion";

export interface Remark { lens: LensId; note: string }
export interface ClaimView { claim: Claim; author: LensId; status: ClaimStatus; note?: string; supporters: Remark[]; challenges: Remark[]; refinements: Remark[] }
export interface ActionView extends NextCheck { lens: LensId; rank: number; rationale: string }

export function claimViews(t: Omit<Transcript, "verification">): ClaimView[] {
  const byId = new Map(t.positions.flatMap(p => p.claims.map(c => [c.id, { claim: c, author: p.lens }] as const)));
  return t.synthesis.claims.map(s => {
    const base = byId.get(s.id)!, rs = t.reviews.filter(r => r.target === s.id);
    const pick = (stance: string) => rs.filter(r => r.stance === stance).map(({ lens, note }) => ({ lens, note }));
    return { ...base, status: s.status, ...(s.note ? { note: s.note } : {}), supporters: pick("support"), challenges: pick("challenge"), refinements: pick("refine") };
  });
}
export function actionViews(t: Omit<Transcript, "verification">): ActionView[] {
  const checks = new Map(t.positions.flatMap(p => p.nextChecks.map(n => [n.id, { ...n, lens: p.lens }] as const)));
  return t.synthesis.actions.map((a, i) => ({ ...checks.get(a.check)!, rank: i + 1, rationale: a.rationale }));
}
