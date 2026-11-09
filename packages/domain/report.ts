// Renders a discussion as the self-contained report a reader (and a goldfish reviewer) sees.
// Deterministic: the same discussion always yields the same text, so its hash identifies what was reviewed.
import type { Discussion, SynthesizedClaim } from "../contracts/discussion";

const kind = { observation: "관측", hypothesis: "가설", assumption: "가정", vendor_claim: "업체 주장" } as const;
const cost = { low: "낮음", medium: "중간", high: "높음" } as const;
const pct = (n: number) => Math.round(n * 100) + "%";

// Common fab and deployment terms. A term is listed only when the report uses it.
export const glossary: Record<string, string> = {
  PM: "예방 정비(Preventive Maintenance). 정해진 주기로 부품을 교체·세정하는 작업",
  FDC: "Fault Detection and Classification. 장비 센서 트레이스로 이상을 감지하는 시스템",
  SPC: "Statistical Process Control. 관리 한계로 공정 변동을 감시하는 통계 기법",
  EWMA: "지수가중이동평균. 작은 드리프트를 감지하는 SPC 관리도",
  CD: "Critical Dimension. 패턴의 임계 선폭",
  MES: "Manufacturing Execution System. lot·장비 이력을 관리하는 생산 실행 시스템",
  EES: "Equipment Engineering System. 장비 데이터 수집·분석 시스템",
  SECS: "SEMI Equipment Communications Standard. 장비-호스트 통신 표준",
  GEM: "Generic Equipment Model. SECS 위의 장비 동작 표준",
  VM: "가상 계측(Virtual Metrology). 센서 데이터로 계측값을 예측하는 모델",
  ML: "기계 학습",
  AI: "인공지능",
  RF: "Radio Frequency. 플라즈마 공정의 고주파 전력",
  PECVD: "Plasma-Enhanced Chemical Vapor Deposition. 플라즈마 화학 기상 증착",
  CVD: "Chemical Vapor Deposition. 화학 기상 증착",
  TLS: "전송 계층 암호화 프로토콜",
  CA: "인증 기관(Certificate Authority). 사내 CA는 고객사가 자체 발급한 인증서 체계",
  OS: "운영체제",
  GPU: "그래픽 처리 장치. 모델 학습·추론용 가속기",
  CPU: "중앙 처리 장치",
  PC: "개인용 컴퓨터. 장비 PC는 장비에 붙어 제어·통신을 맡는 컴퓨터",
  CI: "지속적 통합(Continuous Integration). 변경마다 자동으로 빌드·테스트하는 환경",
  API: "프로그램 간 호출 인터페이스",
  DNS: "도메인 이름 시스템",
};

function claimLine(c: SynthesizedClaim): string {
  const head = `- \`${c.claim.id}\` ${c.claim.statement} (${kind[c.claim.kind]}, 확신 ${pct(c.claim.confidence)}, 작성 ${c.author})`;
  const ev = c.claim.evidence ? `\n  - 근거: ${c.claim.evidence}` : "";
  const sup = c.supporters.length ? `\n  - 지지: ${c.supporters.join(", ")}` : "";
  const ch = c.challenges.map(r => `\n  - 반대(${r.lens}): ${r.note}`).join("");
  const rf = c.refinements.map(r => `\n  - 보완(${r.lens}): ${r.note}`).join("");
  return head + ev + sup + ch + rf;
}

export function renderReport(d: Omit<Discussion, "verification">): string {
  const s = d.synthesis, out: string[] = [];
  out.push(`# 멀티 에이전트 검토: ${d.problem.title}`, "");
  out.push("## 문제", "", d.problem.statement, ...(d.problem.context ? ["", `맥락: ${d.problem.context}`] : []), "");
  out.push("## 검토 범위", "", `관점: ${d.lenses.join(", ")}`, `탐색 ${s.coverage.explored}/${s.coverage.requested} · 교차 검토 참여 ${s.coverage.reviewed} · 실패 ${s.coverage.failed.length ? s.coverage.failed.map(f => `${f.lens}(${f.round}라운드, ${f.error})`).join(", ") : "없음"}`, "");
  out.push("## 한 줄 결론", "", s.headline, "");
  out.push("## 우선 확인할 일", "", ...(s.actions.length ? s.actions.map((a, i) => `${i + 1}. \`${a.id}\` ${a.action} (제안 ${a.lens}, 판별 대상 ${a.resolves.length ? a.resolves.map(r => "`" + r + "`").join(", ") : "없음"}, 비용 ${cost[a.cost]})`) : ["- 없음"]), "");
  out.push("## 쟁점", "", ...(s.contested.length ? s.contested.map(claimLine) : ["- 없음"]), "");
  out.push("## 합의 (여러 관점의 같은 추정이며 사실 확인이 아님)", "", ...(s.consensus.length ? s.consensus.map(claimLine) : ["- 없음"]), "");
  out.push("## 단일 관점", "", ...(s.singleSource.length ? s.singleSource.map(claimLine) : ["- 없음"]), "");
  if (s.questions.length) out.push("## 열린 질문", "", ...s.questions.map(q => `- ${q.text} (${q.lenses.join(", ")})`), "");
  if (s.risks.length) out.push("## 위험", "", ...s.risks.map(q => `- ${q.text} (${q.lenses.join(", ")})`), "");
  const body = out.join("\n");
  const used = Object.keys(glossary).filter(t => new RegExp(`(^|[^A-Za-z])${t}([^A-Za-z]|$)`).test(body));
  if (used.length) out.push("## 용어", "", ...used.map(t => `- ${t}: ${glossary[t]}`), "");
  out.push(`transcript SHA-256 ${d.sourceHash}`);
  return out.join("\n") + "\n";
}
