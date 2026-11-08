// pnpm discussion demo [sample-id]           → fixture discussion JSON on stdout
// pnpm discussion synthesize <transcript.json> [--out discussion.json]
//   Checks a host-run transcript (fde-multi-agent-review skill) and adds the deterministic synthesis.
//   --out never replaces an existing file.
import { readFileSync, writeFileSync } from "node:fs";
import { runDiscussion, synthesizeTranscript } from "./index";
import { fixtureProvider } from "./fixture";
import { samples } from "./samples";

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
    const d = synthesizeTranscript(JSON.parse(readFileSync(arg, "utf8")));
    emit(d);
    console.error(d.synthesis.headline);
  } else {
    console.error("usage: pnpm discussion demo [sample-id] | pnpm discussion synthesize <transcript.json> [--out file]");
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
