// Parallel discussion orchestrator.
// Round 1 (blind): every lens agent explores the same problem packet at once, without seeing the others, to avoid anchoring.
// Round 2 (cross-review): each surviving agent supports, challenges or refines the other lenses' claims, again in parallel.
// Synthesis is deterministic (packages/domain/discussion.ts). A failed or slow agent is recorded, never silently dropped.
import { createHash } from "node:crypto";
import { assertProblem, assertTranscript, isPosition, isReview, lensIds, type Claim, type Discussion, type Failure, type LensId, type NextCheck, type Position, type Problem, type Review, type Stance, type Transcript } from "../contracts/discussion";
import { synthesize } from "../domain/discussion";
import { lensCatalog, type Lens } from "./lenses";
import { AgentFailure, bounded } from "./bounded";
import { verifyDiscussion, type GoldfishEvent, type GoldfishReviewer, type VerifyOptions } from "./goldfish";

export { builtInReviewers, defaultGoldfish, type GoldfishReviewer, type GoldfishPacket } from "./goldfish";

export { lensCatalog, defaultLenses } from "./lenses";
export const discussionCapability = { id: "discussion.v1", minLenses: 2, maxLenses: lensIds.length, agentTimeoutMs: 20000, totalTimeoutMs: 120000, externalTransfer: false, sideEffects: false };

export interface AgentContext { lens: Lens; signal: AbortSignal }
export interface Exploration { summary: string; claims: Claim[]; risks: string[]; nextChecks: NextCheck[]; questions: string[] }
export interface PeerClaims { lens: LensId; claims: Claim[] }
export interface LensAgent {
  explore(problem: Problem, ctx: AgentContext): Promise<Exploration>;
  review(problem: Problem, peers: PeerClaims[], ctx: AgentContext): Promise<{ target: string; stance: Stance; note: string }[]>;
}
export interface AgentProvider { id: string; mode: "fixture" | "live"; agent(lens: Lens): LensAgent }

export type DiscussionEvent =
  | { type: "start"; lenses: LensId[]; provider: string }
  | { type: "agent"; round: 1 | 2; lens: LensId; state: "running" }
  | { type: "agent"; round: 1 | 2; lens: LensId; state: "done"; durationMs: number; count: number }
  | { type: "agent"; round: 1 | 2; lens: LensId; state: "failed"; error: Failure["error"] }
  | { type: "position"; position: Position }
  | GoldfishEvent
  | { type: "done"; discussion: Discussion };

export interface RunOptions { signal?: AbortSignal; agentTimeoutMs?: number; goldfish?: GoldfishReviewer[]; onEvent?: (e: DiscussionEvent) => void }

export function parseRequest(body: Record<string, unknown>): { problem: Problem; lenses: LensId[] } {
  assertProblem(body.problem);
  const lenses = body.lenses;
  if (!Array.isArray(lenses) || lenses.length < discussionCapability.minLenses || lenses.length > discussionCapability.maxLenses || new Set(lenses).size !== lenses.length || lenses.some(l => !(lensIds as readonly unknown[]).includes(l))) throw new Error("invalid_input");
  return { problem: body.problem, lenses: lenses as LensId[] };
}

export async function runDiscussion(input: { problem: Problem; lenses: LensId[] }, provider: AgentProvider, options: RunOptions = {}): Promise<Discussion> {
  const outer = options.signal ?? new AbortController().signal, ms = options.agentTimeoutMs ?? discussionCapability.agentTimeoutMs, emit = options.onEvent ?? (() => {});
  const { problem, lenses } = input, failures: Failure[] = [];
  const agents = new Map(lenses.map(l => [l, provider.agent(lensCatalog[l])]));
  emit({ type: "start", lenses, provider: provider.id });

  const explored = await Promise.all(lenses.map(async (lens): Promise<Position | null> => {
    emit({ type: "agent", round: 1, lens, state: "running" });
    const started = performance.now();
    try {
      const out = await bounded(signal => agents.get(lens)!.explore(problem, { lens: lensCatalog[lens], signal }), outer, ms);
      const position = { lens, skill: lensCatalog[lens].skill, ...pickExploration(out), durationMs: Math.round(performance.now() - started) };
      if (!isPosition(position) || position.claims.some(c => !c.id.startsWith(lens + ".")) || position.nextChecks.some(n => !n.id.startsWith(lens + ".c") || n.resolves.some(r => !position.claims.some(c => c.id === r)))) throw new AgentFailure("invalid_output");
      emit({ type: "agent", round: 1, lens, state: "done", durationMs: position.durationMs, count: position.claims.length });
      emit({ type: "position", position });
      return position;
    } catch (e) {
      const error = e instanceof AgentFailure ? e.code : "agent_error";
      failures.push({ lens, round: 1, error }); emit({ type: "agent", round: 1, lens, state: "failed", error });
      return null;
    }
  }));
  const positions = explored.filter((p): p is Position => !!p);

  const reviewed = await Promise.all(positions.map(async (own): Promise<Review[]> => {
    const lens = own.lens, peers = positions.filter(p => p.lens !== lens).map(p => ({ lens: p.lens, claims: p.claims }));
    if (!peers.length) return [];
    emit({ type: "agent", round: 2, lens, state: "running" });
    const started = performance.now();
    try {
      const out = await bounded(signal => agents.get(lens)!.review(problem, peers, { lens: lensCatalog[lens], signal }), outer, ms);
      const targets = new Set(peers.flatMap(p => p.claims.map(c => c.id))), seen = new Set<string>();
      if (!Array.isArray(out)) throw new AgentFailure("invalid_output");
      const reviews = out.map(r => ({ lens, target: r?.target, stance: r?.stance, note: r?.note }));
      for (const r of reviews) { if (!isReview(r) || !targets.has(r.target) || seen.has(r.target)) throw new AgentFailure("invalid_output"); seen.add(r.target); }
      emit({ type: "agent", round: 2, lens, state: "done", durationMs: Math.round(performance.now() - started), count: reviews.length });
      return reviews as Review[];
    } catch (e) {
      const error = e instanceof AgentFailure ? e.code : "agent_error";
      failures.push({ lens, round: 2, error }); emit({ type: "agent", round: 2, lens, state: "failed", error });
      return [];
    }
  }));
  if (outer.aborted) throw new Error("cancelled");

  const order = (a: Failure, b: Failure) => a.round - b.round || lenses.indexOf(a.lens) - lenses.indexOf(b.lens);
  const transcript: Transcript = { version: "1", problem, lenses, provider: { id: provider.id, mode: provider.mode }, positions, reviews: reviewed.flat(), failures: failures.sort(order) };
  const discussion = await finalize(transcript, { reviewers: options.goldfish, signal: outer, timeoutMs: ms, onEvent: emit });
  emit({ type: "done", discussion });
  return discussion;
}

// Host-run discussions (the fde-multi-agent-review skill) arrive as a transcript file. It is checked like any agent output
// and re-synthesized here; its provenance is recorded as imported. Goldfish findings the host ran are merged, and the
// built-in reviewers still run on the re-rendered report.
export async function synthesizeTranscript(input: unknown, options: Omit<VerifyOptions, "host"> = {}): Promise<Discussion> {
  assertTranscript(input);
  return finalize({ ...input, provider: { id: input.provider.id, mode: "imported" } }, options);
}

// Round 3: once synthesized by the context-holding orchestrator, the report goes to fresh-context goldfish reviewers.
async function finalize(t: Transcript, options: Omit<VerifyOptions, "host">): Promise<Discussion> {
  assertTranscript(t);
  const { verification: host, ...rest } = t;
  const stable = { ...rest, positions: rest.positions.map(({ durationMs: _d, ...p }) => p) };
  const base = { ...rest, sourceHash: createHash("sha256").update(JSON.stringify(stable)).digest("hex"), synthesis: synthesize(rest) };
  return { ...base, verification: await verifyDiscussion(base, { ...options, host }) };
}
const pickExploration = (o: Exploration) => ({ summary: o?.summary, claims: o?.claims, risks: o?.risks, nextChecks: o?.nextChecks, questions: o?.questions });
