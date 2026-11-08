// Multi-agent discussion contract. Agent output is untrusted: every position and review passes this schema
// before it reaches synthesis. Synthesis itself is derived (packages/domain/discussion.ts), never accepted as input.
import Ajv from "ajv";
import schema from "./discussion.schema.json";

export const lensIds = ["discovery", "field-debug", "problem-design", "validation", "security", "target-env", "cost", "compat-scale"] as const;
export type LensId = (typeof lensIds)[number];
export type ClaimKind = "observation" | "hypothesis" | "assumption" | "vendor_claim";
export type Stance = "support" | "challenge" | "refine";
export interface Problem { title: string; statement: string; context?: string }
export interface Claim { id: string; statement: string; kind: ClaimKind; confidence: number; tags: string[]; evidence?: string }
export interface NextCheck { id: string; action: string; cost: "low" | "medium" | "high"; resolves: string[] }
export interface Position { lens: LensId; skill: string; summary: string; claims: Claim[]; risks: string[]; nextChecks: NextCheck[]; questions: string[]; durationMs: number }
export interface Review { lens: LensId; target: string; stance: Stance; note: string }
export interface Failure { lens: LensId; round: 1 | 2; error: "timeout" | "agent_error" | "invalid_output" | "cancelled" }
export interface Transcript { version: "1"; problem: Problem; lenses: LensId[]; provider: { id: string; mode: "fixture" | "live" | "imported" }; positions: Position[]; reviews: Review[]; failures: Failure[] }

export type ClaimStatus = "consensus" | "contested" | "single_source";
export interface Remark { lens: LensId; note: string }
export interface SynthesizedClaim { claim: Claim; author: LensId; status: ClaimStatus; supporters: LensId[]; challenges: Remark[]; refinements: Remark[]; weight: number }
export interface RankedAction extends NextCheck { lens: LensId; priority: number; rationale: string }
export interface Merged { text: string; lenses: LensId[] }
export interface Synthesis {
  headline: string;
  agreement: number;
  coverage: { requested: number; explored: number; reviewed: number; failed: Failure[] };
  consensus: SynthesizedClaim[];
  contested: SynthesizedClaim[];
  singleSource: SynthesizedClaim[];
  actions: RankedAction[];
  questions: Merged[];
  risks: Merged[];
}
export interface Discussion extends Transcript { sourceHash: string; synthesis: Synthesis }

const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addSchema(schema);
const get = (def: string) => { const v = ajv.getSchema(`fde.discussion.v1#/definitions/${def}`); if (!v) throw new Error("schema_missing"); return v; };
const transcriptValidator = get("transcript"), positionValidator = get("position"), reviewValidator = get("review"), problemValidator = get("problem");

export const isPosition = (v: unknown): v is Position => positionValidator(v) as boolean;
export const isReview = (v: unknown): v is Review => reviewValidator(v) as boolean;
export function assertProblem(v: unknown): asserts v is Problem { if (!problemValidator(v)) throw new Error("invalid_input"); }
// Structural check plus referential integrity: claim ids belong to their lens and are unique,
// reviews target existing claims of another lens, one stance per reviewer and claim.
export function assertTranscript(v: unknown): asserts v is Transcript {
  if (!transcriptValidator(v)) throw new Error("invalid_transcript");
  const t = v as Transcript, owner = new Map<string, LensId>(), seenLens = new Set<LensId>(), seenReview = new Set<string>();
  for (const p of t.positions) {
    if (!t.lenses.includes(p.lens) || seenLens.has(p.lens)) throw new Error("invalid_transcript");
    seenLens.add(p.lens);
    for (const c of p.claims) { if (!c.id.startsWith(p.lens + ".") || owner.has(c.id)) throw new Error("invalid_transcript"); owner.set(c.id, p.lens); }
    // Round 1 is blind, so a next check can only resolve its own lens's claims.
    const own = new Set(p.claims.map(c => c.id)), checks = new Set<string>();
    for (const n of p.nextChecks) { if (!n.id.startsWith(p.lens + ".c") || checks.has(n.id) || n.resolves.some(r => !own.has(r))) throw new Error("invalid_transcript"); checks.add(n.id); }
  }
  for (const r of t.reviews) {
    const author = owner.get(r.target), key = r.lens + "|" + r.target;
    if (!author || author === r.lens || !seenLens.has(r.lens) || seenReview.has(key)) throw new Error("invalid_transcript");
    seenReview.add(key);
  }
  for (const f of t.failures) if (!t.lenses.includes(f.lens)) throw new Error("invalid_transcript");
}
