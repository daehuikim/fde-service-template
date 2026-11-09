// Accepts a discussion record produced by a host assistant with the fde-multi-agent-review skill.
// Checks the contract and that the goldfish reviewed exactly this record's report; computes content hashes.
// No agent runs in this app and nothing here judges the content.
import { createHash } from "node:crypto";
import { assertTranscript, type Discussion, type Transcript } from "../contracts/discussion";
import { renderReport } from "../domain/report";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const reportHash = (t: Omit<Transcript, "verification">) => sha256(renderReport(t));

export function acceptDiscussion(input: unknown): Discussion {
  if (input && typeof input === "object" && "sourceHash" in input) { const { sourceHash: _s, ...rest } = input as Record<string, unknown>; input = rest; }
  assertTranscript(input);
  const { verification, ...base } = input;
  // A goldfish verdict only covers the report it read. Any edit to the record after review invalidates it.
  if (verification.reportHash !== reportHash(base)) throw new Error("stale_verification");
  const stable = { ...input, positions: input.positions.map(({ durationMs: _d, ...p }) => p) };
  return { ...input, sourceHash: sha256(JSON.stringify(stable)) };
}
