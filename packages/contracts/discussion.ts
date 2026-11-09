// Multi-agent discussion contract (v2). Every judgment in the record — claims, stances, synthesis, goldfish findings and
// the verdict — is produced by the host assistant running the fde-multi-agent-review skill. This module only checks that
// the record is well formed and internally referenced; it never classifies, ranks or reviews anything itself.
import Ajv from "ajv";
import schema from "./discussion.schema.json";

export const lensIds = ["discovery", "field-debug", "problem-design", "validation", "security", "target-env", "cost", "compat-scale"] as const;
export type LensId = (typeof lensIds)[number];
export type ClaimKind = "observation" | "hypothesis" | "assumption" | "vendor_claim";
export type Stance = "support" | "challenge" | "refine";
export type ClaimStatus = "consensus" | "contested" | "single_source";
export type Severity = "blocker" | "major" | "nit";
export type Verdict = "pass" | "attention" | "blocked" | "incomplete";
export interface Problem { title: string; statement: string; context?: string }
export interface Claim { id: string; statement: string; kind: ClaimKind; confidence: number; tags: string[]; evidence?: string }
export interface NextCheck { id: string; action: string; cost: "low" | "medium" | "high"; resolves: string[] }
export interface Position { lens: LensId; skill: string; summary: string; claims: Claim[]; risks: string[]; nextChecks: NextCheck[]; questions: string[]; durationMs: number }
export interface Review { lens: LensId; target: string; stance: Stance; note: string }
export interface Failure { lens: LensId; round: 1 | 2; error: "timeout" | "agent_error" | "invalid_output" | "cancelled" }
export interface Synthesis { headline: string; claims: { id: string; status: ClaimStatus; note?: string }[]; actions: { check: string; rationale: string }[]; questions: string[]; risks: string[] }
export interface GoldfishFinding { severity: Severity; scope: string; finding: string; recommendation: string }
export interface GoldfishReviewer { reviewer: string; status: "completed" | "not_run"; attempts: 1 | 2; findings: GoldfishFinding[] }
export interface Verification { reportHash: string; verdict: Verdict; reviewers: GoldfishReviewer[] }
export interface Transcript { version: "2"; problem: Problem; lenses: LensId[]; runner: { host: string; model?: string }; positions: Position[]; reviews: Review[]; failures: Failure[]; synthesis: Synthesis; verification: Verification }
export interface Discussion extends Transcript { sourceHash: string }

const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addSchema(schema);
const transcriptValidator = ajv.getSchema("fde.discussion.v2#/definitions/transcript");
if (!transcriptValidator) throw new Error("schema_missing");

// Structure and references only: ids belong to their lens and are unique, reviews target another lens's existing
// claim once, the synthesis classifies every claim exactly once and ranks existing checks, and goldfish records keep
// "not run" distinct from "no findings". Whether a classification or verdict is right is the skill's and the reader's call.
export function assertTranscript(v: unknown): asserts v is Transcript {
  if (!transcriptValidator!(v)) throw new Error("invalid_transcript");
  const t = v as Transcript, owner = new Map<string, LensId>(), seenLens = new Set<LensId>(), checks = new Set<string>(), seenReview = new Set<string>();
  const fail = () => { throw new Error("invalid_transcript"); };
  for (const p of t.positions) {
    if (!t.lenses.includes(p.lens) || seenLens.has(p.lens)) fail();
    seenLens.add(p.lens);
    for (const c of p.claims) { if (!c.id.startsWith(p.lens + ".") || owner.has(c.id)) fail(); owner.set(c.id, p.lens); }
    // Round 1 is blind, so a next check can only resolve its own lens's claims.
    const own = new Set(p.claims.map(c => c.id));
    for (const n of p.nextChecks) { if (!n.id.startsWith(p.lens + ".c") || checks.has(n.id) || n.resolves.some(r => !own.has(r))) fail(); checks.add(n.id); }
  }
  for (const r of t.reviews) {
    const author = owner.get(r.target), key = r.lens + "|" + r.target;
    if (!author || author === r.lens || !seenLens.has(r.lens) || seenReview.has(key)) fail();
    seenReview.add(key);
  }
  for (const f of t.failures) if (!t.lenses.includes(f.lens)) fail();
  const classified = t.synthesis.claims.map(c => c.id);
  if (new Set(classified).size !== classified.length || classified.length !== owner.size || classified.some(id => !owner.has(id))) fail();
  const ranked = t.synthesis.actions.map(a => a.check);
  if (new Set(ranked).size !== ranked.length || ranked.some(c => !checks.has(c))) fail();
  const names = t.verification.reviewers.map(r => r.reviewer);
  if (new Set(names).size !== names.length || t.verification.reviewers.some(r => r.status === "not_run" && r.findings.length)) fail();
  if (t.verification.verdict === "pass" && t.verification.reviewers.some(r => r.status === "not_run" || r.findings.some(f => f.severity === "blocker"))) fail();
}
