// pnpm discussion demo [sample-id]           → fixture discussion JSON on stdout
// pnpm discussion synthesize <transcript.json> [--out discussion.json]
// pnpm discussion report <discussion.json>   → the Markdown report goldfish reviewers read
//   Checks a host-run transcript (fde-multi-agent-review skill) and adds the deterministic synthesis.
//   --out never replaces an existing file.
import { readFileSync, writeFileSync } from "node:fs";
import { runDiscussion, synthesizeTranscript } from "./index";
import { fixtureProvider } from "./fixture";
import { samples } from "./samples";
import { renderReport } from "../domain/report";

const [command, arg, ...rest] = process.argv.slice(2);
const out = rest[0] === "--out" ? rest[1] : undefined;
function emit(value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (out) { writeFileSync(out, text, { flag: "wx" }); console.error(`wrote ${out}`); } else process.stdout.write(text);
}
try {
  if (command === "demo") {
    const sample = samples.find(s => s.id === (arg ?? samples[0].id));
    if (!sample) throw new Error(`unknown sample; choose one of ${samples.map(s => s.id).join(", ")}`);
    emit(await runDiscussion({ problem: sample.problem, lenses: sample.lenses }, fixtureProvider()));
  } else if (command === "synthesize" && arg) {
    const d = await synthesizeTranscript(JSON.parse(readFileSync(arg, "utf8")));
    emit(d);
    console.error(d.synthesis.headline);
    console.error(`goldfish verification: ${d.verification.verdict} · ${d.verification.findings.length} findings · ${d.verification.reviewers.map(r => `${r.reviewer}=${r.status}`).join(", ")}`);
  } else if (command === "report" && arg) {
    const { verification: _v, ...d } = JSON.parse(readFileSync(arg, "utf8"));
    process.stdout.write(renderReport(d));
  } else {
    console.error("usage: pnpm discussion demo [sample-id] | pnpm discussion synthesize <transcript.json> [--out file] | pnpm discussion report <discussion.json>");
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
