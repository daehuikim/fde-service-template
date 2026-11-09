// Per-agent time box shared by every round. Cancellation of the whole run and a single agent's timeout are told apart.
import type { Failure } from "../contracts/discussion";

export class AgentFailure extends Error { constructor(readonly code: Failure["error"]) { super(code); } }
export async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, outer: AbortSignal, ms: number): Promise<T> {
  const local = new AbortController(), timer = setTimeout(() => local.abort(), ms);
  const signal = AbortSignal.any([outer, local.signal]);
  const reason = () => new AgentFailure(outer.aborted ? "cancelled" : "timeout");
  let onAbort = () => {};
  // Race against the signal so an agent that ignores cancellation cannot hold the round open.
  const aborted = new Promise<never>((_, reject) => { onAbort = () => reject(reason()); signal.addEventListener("abort", onAbort, { once: true }); });
  try { if (signal.aborted) throw reason(); return await Promise.race([work(signal), aborted]); }
  catch (e) { throw e instanceof AgentFailure ? e : signal.aborted ? reason() : new AgentFailure("agent_error"); }
  finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
}
