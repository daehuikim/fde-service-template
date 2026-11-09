// Tools the fde-multi-agent-review skill calls while the host assistant runs the discussion. They format and check;
// they never produce claims, stances, synthesis or findings.
//   pnpm discussion report <record.json>               → Markdown report for goldfish (its SHA-256 on stderr)
//   pnpm discussion check <record.json> [--out file]   → contract + report-hash check; --out never overwrites
import { readFileSync, writeFileSync } from "node:fs";
import { assertTranscript, type Transcript } from "../contracts/discussion";
import { renderReport } from "../domain/report";
import { acceptDiscussion, reportHash } from "./record";

const [command, arg, flag, out] = process.argv.slice(2);
try {
  if (command === "report" && arg) {
    const { verification: _v, sourceHash: _s, ...base } = JSON.parse(readFileSync(arg, "utf8"));
    // Before round 3 the record has no verification yet; check everything else with a placeholder.
    assertTranscript({ ...base, verification: { reportHash: "0".repeat(64), verdict: "incomplete", reviewers: [{ reviewer: "pending", status: "not_run", attempts: 1, findings: [] }] } });
    process.stdout.write(renderReport(base as Omit<Transcript, "verification">));
    console.error(`reportHash ${reportHash(base as Omit<Transcript, "verification">)}`);
  } else if (command === "check" && arg) {
    const d = acceptDiscussion(JSON.parse(readFileSync(arg, "utf8")));
    if (flag === "--out" && out) { writeFileSync(out, JSON.stringify(d, null, 2) + "\n", { flag: "wx" }); console.error(`wrote ${out}`); }
    const n = d.verification.reviewers;
    console.log(`ok · ${d.positions.length}/${d.lenses.length} lenses · ${d.reviews.length} reviews · goldfish ${n.filter(r => r.status === "completed").length}/${n.length} · verdict ${d.verification.verdict} · sha256 ${d.sourceHash.slice(0, 12)}`);
  } else {
    console.error("usage: pnpm discussion report <record.json> | pnpm discussion check <record.json> [--out file]");
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
