// Offline fixture provider: deterministic, rule-based lens agents for synthetic semiconductor fab problems.
// It demonstrates the discussion structure, contracts and UI without a model or network call.
// Its claims are reviewer prompts drawn from common fab troubleshooting practice, not findings about any real site.
import type { Claim, ClaimKind, LensId, Problem, Stance } from "../contracts/discussion";
import type { AgentProvider, Exploration, LensAgent, PeerClaims } from "./index";

interface Rule { when?: RegExp; claim: Omit<Claim, "id">; check?: { action: string; cost: "low" | "medium" | "high" } }
interface ReviewRule { tags?: string[]; kinds?: ClaimKind[]; minConfidence?: number; stance: Stance; note: string }
interface Knowledge { summary: string; rules: Rule[]; reviews: ReviewRule[]; questions: string[]; risks: string[]; latencyMs: number }

const h = (statement: string, confidence: number, tags: string[], kind: ClaimKind = "hypothesis", evidence?: string): Omit<Claim, "id"> => ({ statement, kind, confidence, tags, ...(evidence ? { evidence } : {}) });
const ML = /\bML\b|\bAI\b|\bVM\b|머신\s*러닝|딥러닝|예측\s*모델|모델\s*(?:학습|기반)|가상\s*계측|[Vv]irtual [Mm]etrology/;

const knowledge: Record<LensId, Knowledge> = {
  "discovery": {
    summary: "결정과 현행 업무부터 고정합니다. 이 문제로 바뀌는 결정(장비 inhibit, lot hold, 레시피 변경)과 지금의 수작업 대조가 baseline입니다.",
    latencyMs: 700,
    rules: [
      { claim: h("현재 baseline은 엔지니어가 SPC 차트·장비 로그·PM 기록을 수동으로 대조하는 흐름이며, 개선은 이 대조 시간과 판단 누락으로 측정해야 한다.", 0.6, ["baseline", "spc"], "assumption"), check: { action: "담당 엔지니어의 대조 작업 1회를 관찰해 사용 화면·소요 시간·판단 근거를 기록", cost: "low" } },
      { when: /FDC|알람|alarm|인터락|interlock/i, claim: h("FDC 알람이 울리지 않은 것은 이상이 없어서가 아니라, 해당 파라미터가 감시 대상이 아니거나 한계가 넓게 설정됐기 때문일 수 있다.", 0.55, ["fdc", "baseline"]), check: { action: "문제 기간 FDC 감시 파라미터 목록, 한계값, 알람 억제(suppress) 이력 확인", cost: "low" } },
      { when: /수율|yield|%p/i, claim: h("수율 하락분 중 이 현상에 귀속되는 몫이 분리되지 않았다. 같은 기간 다른 공정 변경이 섞여 있을 수 있다.", 0.6, ["yield", "baseline"], "assumption"), check: { action: "같은 기간 공정 변경 이력(레시피, 소재 lot, 장비 이동)을 시간축에 정렬", cost: "low" } },
      { when: /폐쇄망|air.?gap|설치|배포|서버/i, claim: h("현장 담당자는 원인보다 '언제 다시 쓸 수 있는가'를 먼저 묻는다. 우회 운영 방법이 첫 산출물이 될 수 있다.", 0.45, ["deployment", "baseline"], "assumption") },
    ],
    reviews: [
      { tags: ["ml"], stance: "refine", note: "현행 수작업 대비 무엇이 줄어드는지 먼저 정해야 모델 도입 여부를 판단할 수 있습니다." },
    ],
    questions: ["이 결과로 바뀌는 결정은 무엇이고 결정권자는 누구인가(장비 inhibit, lot hold, 레시피 변경)?", "성공 기준은 탐지 리드타임, 오탐률, 엔지니어 시간 중 무엇인가?"],
    risks: ["결정권자 없이 분석만 정교해져 현장 조치로 이어지지 않는 경우"],
  },
  "field-debug": {
    summary: "정상 기준과 이상의 차이표를 만들고, 소거 비용이 낮은 가설부터 확인합니다.",
    latencyMs: 1100,
    rules: [
      { when: /\bPM\b|정비|[Mm]aintenance|부품\s*교체/, claim: h("PM 중 교체·재조립된 부품(샤워헤드, O-ring, 엣지링)이나 생략된 시즌닝이 1순위 원인 후보다.", 0.72, ["pm", "particle"], "hypothesis", "문제 기술: PM 이후 시작"), check: { action: "PM 작업 기록, 교체 부품 lot, 시즌닝 레시피 수행 여부와 결과 wafer 확인", cost: "low" } },
      { when: /챔버|chamber|호기|장비\s*[A-Z0-9]/i, claim: h("같은 레시피의 정상 챔버가 있다면 레시피 자체보다 챔버 고유 요인(하드웨어, 센서 offset, 소모품 수명)이 유력하다.", 0.6, ["chamber-matching", "recipe"], "observation", "문제 기술: 정상 챔버와 이상 챔버가 공존"), check: { action: "정상/이상 챔버의 FDC 트레이스(RF, 압력, 온도, 가스 유량)를 같은 recipe step 기준으로 겹쳐 비교", cost: "medium" } },
      { when: /\bCD\b|드리프트|[Dd]rift|점점|서서히/, claim: h("서서히 진행되는 드리프트는 챔버 벽 폴리머 누적·소모품 마모와 상관될 수 있다. RF hour 또는 마지막 wet clean 이후 경과와 함께 봐야 한다.", 0.55, ["cd-drift", "pm"]), check: { action: "lot별 CD를 RF hour·wet clean 이후 경과 시간에 대해 산점도로 확인", cost: "low" } },
      { when: /레시피|recipe/i, claim: h("최근 레시피 개정이나 recipe parameter 오버라이드가 있었는지 확인되지 않았다.", 0.35, ["recipe"]), check: { action: "레시피 관리 시스템에서 문제 시작 전후 개정·오버라이드 이력 조회", cost: "low" } },
      { when: /폐쇄망|air.?gap|프록시|proxy|설치|배포|서버/i, claim: h("우리 환경과 고객 환경의 차이(프록시, 사내 CA, OS·glibc, 권한)가 원인 후보다.", 0.5, ["deployment", "proxy"]), check: { action: "env-probe.sh 결과로 정상/실패 환경 차이표 작성", cost: "low" } },
      { claim: h("첫 오류 시점과 연쇄 증상을 구분하지 않으면 가설이 계속 늘어난다.", 0.5, ["baseline"], "assumption") },
    ],
    reviews: [
      { tags: ["ml"], stance: "challenge", note: "원인 후보가 소거되지 않은 상태에서 모델을 만들면 증상을 예측할 뿐 원인을 고치지 못합니다." },
    ],
    questions: ["이상이 처음 관측된 lot·시각과 그 직전 장비 이벤트는?"],
    risks: ["알람 한계 완화나 재작업 증가 같은 증상 억제로 끝나는 조치"],
  },
  "problem-design": {
    summary: "가장 단순한 baseline(규칙·SPC·차이표)을 먼저 검증하고, 실패할 때만 모델로 넘어갑니다.",
    latencyMs: 900,
    rules: [
      { claim: h("첫 산출물은 원인을 확정하는 시스템이 아니라 엔지니어의 대조 시간을 줄이는 챔버 차이표·우선순위 목록이다.", 0.55, ["baseline", "chamber-matching"], "assumption"), check: { action: "차이표 시안을 엔지니어 2명에게 보여 주고 다음 조치 결정이 빨라지는지 확인", cost: "low" } },
      { when: ML, claim: h("ML 가상계측보다 EWMA/SPC 규칙과 챔버 매칭이 먼저 검증할 baseline이다. 규칙이 놓치는 사례가 확인될 때 모델이 정당화된다.", 0.62, ["ml", "baseline", "spc"]), check: { action: "지난 3개월 데이터로 EWMA/SPC 규칙의 조기 탐지 리드타임과 오탐률 측정", cost: "medium" } },
      { when: /파티클|particle|adder|결함\s*맵|[Dd]efect\s*map/, claim: h("결함 맵의 공간 패턴(엣지·중심·랜덤·스크래치)으로 원인 범주를 먼저 나눌 수 있다.", 0.6, ["particle"]), check: { action: "이상 기간 wafer 결함 맵을 공간 패턴별로 분류", cost: "low" } },
      { when: /여러|전체|fleet|라인|[0-9]+\s*대/i, claim: h("단일 챔버 문제와 fleet 감시 문제는 다른 제품이다. 범위를 하나로 정해야 한다.", 0.5, ["chamber-matching"], "assumption") },
    ],
    reviews: [
      { tags: ["pm"], kinds: ["hypothesis"], stance: "support", note: "변경점(PM)에서 시작하는 소거가 가장 싼 baseline입니다." },
    ],
    questions: ["규칙 기반 baseline이 실패했다고 판단할 기준은 무엇인가?"],
    risks: ["모델 정확도 지표만 좋아지고 현장 결정은 바뀌지 않는 경우"],
  },
  "validation": {
    summary: "각 주장에 대해 '무엇을 보면 틀렸다고 할 것인가'를 먼저 정합니다. 대조군 없는 전후 비교는 증거가 약합니다.",
    latencyMs: 800,
    rules: [
      { claim: h("'정상'의 기준 데이터(기간, wafer 수, 제품)가 정의되지 않으면 이상 여부 판정 자체가 흔들린다.", 0.65, ["baseline", "sample-size"], "assumption"), check: { action: "정상 기준 기간과 wafer 수를 정하고 관리 한계를 그 기간으로 다시 계산", cost: "low" } },
      { when: /수율|yield|%p/i, claim: h("수율 변화를 이 원인에 귀속하려면 같은 기간·같은 제품의 대조 챔버 lot과 층화 비교해야 한다.", 0.7, ["yield", "sample-size"], "assumption"), check: { action: "정상/이상 챔버 lot 수율을 같은 기간·제품으로 층화 비교", cost: "medium" } },
      { when: ML, claim: h("가상계측 성능을 random split으로 평가하면 시간 누수로 과대평가된다. 시간순 분할과 PM 경계 분리가 필요하다.", 0.75, ["ml", "sample-size"], "assumption"), check: { action: "PM 주기 경계로 나눈 시간순 hold-out 평가 계획 작성", cost: "low" } },
      { when: /\bPM\b|정비|[Mm]aintenance/, claim: h("'PM 이후 시작'은 시간 순서일 뿐 인과가 아니다. 같은 PM을 받은 다른 챔버가 정상이라면 반례가 된다.", 0.6, ["pm", "sample-size"], "assumption"), check: { action: "같은 기간 같은 PM 절차를 받은 챔버 목록과 결과 대조", cost: "low" } },
    ],
    reviews: [
      { kinds: ["hypothesis"], minConfidence: 0.7, stance: "challenge", note: "확신도에 비해 근거가 문제 기술뿐입니다. 반례를 먼저 확인해야 합니다." },
      { tags: ["ml"], stance: "refine", note: "평가 분할(시간순, PM 경계)을 정하기 전에는 성능 주장을 받아들이지 않습니다." },
    ],
    questions: ["각 가설이 틀렸다고 판단할 관측은 무엇인가?"],
    risks: ["대조군 없는 전후 비교로 효과를 주장하는 경우"],
  },
  "security": {
    summary: "장비·MES·FDC 데이터는 반출 불가를 기본값으로 두고, 분석이 고객 망 안에서 끝나는 구조만 허용합니다.",
    latencyMs: 600,
    rules: [
      { claim: h("FDC·MES 원시 데이터와 레시피는 사외 반출 불가로 가정하고, 분석은 고객 망 내부에서 수행해야 한다.", 0.8, ["data-export", "air-gap"], "assumption"), check: { action: "반출 가능한 데이터 범위(집계·비식별)와 승인 절차를 고객 보안 담당에게 확인", cost: "low" } },
      { when: ML, claim: h("외부 학습·추론 서비스를 쓰면 공정 데이터가 반출된다. 망 내부 학습·추론이 가능한지가 모델 선택의 전제다.", 0.7, ["ml", "data-export"], "assumption"), check: { action: "고객 망 내부 GPU/CPU 자원과 모델 반입 승인 절차 확인", cost: "medium" } },
      { when: /\bMES\b|\bEES\b|SECS|\bGEM\b|장비\s*PC|호스트/, claim: h("장비 호스트·MES 연동은 읽기 전용 계정과 별도 망 구간으로 시작해야 한다. 쓰기 권한은 장비 안전에 영향을 준다.", 0.65, ["mes", "deployment"], "assumption") },
    ],
    reviews: [
      { tags: ["ml"], stance: "challenge", note: "모델 학습 위치와 데이터 반출 여부가 정해지지 않았습니다." },
      { tags: ["air-gap", "data-export"], stance: "support", note: "데이터 경계 기본값과 일치합니다." },
    ],
    questions: ["분석 결과(차이표, 리포트)를 사외로 가져올 수 있는가, 아니면 화면 확인만 가능한가?"],
    risks: ["장비 로그·레시피(영업비밀)가 티켓·저장소·외부 AI에 원문으로 첨부되는 경우"],
  },
  "target-env": {
    summary: "분석 도구는 장비 PC가 아니라 고객 분석 서버에 둡니다. 폐쇄망이면 이미지 반입과 오프라인 의존성이 먼저입니다.",
    latencyMs: 750,
    rules: [
      { claim: h("분석 도구는 장비 PC가 아니라 고객 분석 서버에 배치해 장비 인증·SECS/GEM 동작에 영향을 주지 않아야 한다.", 0.6, ["deployment"], "assumption"), check: { action: "고객 분석 서버에서 env-probe.sh 실행 결과 수령", cost: "low" } },
      { when: /폐쇄망|air.?gap|사내망|오프라인|offline/i, claim: h("폐쇄망이므로 이미지·패키지 오프라인 반입, 사내 CA, 내부 registry가 전제 조건이다.", 0.75, ["air-gap", "deployment"], "observation", "문제 기술: 폐쇄망"), check: { action: "반입 절차(매체, 검사, 승인 소요일)와 내부 registry 유무 확인", cost: "low" } },
    ],
    reviews: [{ tags: ["air-gap"], stance: "support", note: "배포 제약과 일치합니다." }],
    questions: ["고객 분석 서버의 OS·컨테이너 런타임 버전과 반입 승인 소요일은?"],
    risks: ["반입 승인에 수 주가 걸려 일정이 밀리는 경우"],
  },
  "cost": {
    summary: "챔버 다운타임과 wafer 손실로 조사 시간의 상한을 정하고, 대안별 운영 비용을 비교합니다.",
    latencyMs: 650,
    rules: [
      { claim: h("챔버 1대의 시간당 가동 가치와 이상 lot의 wafer 손실이 조사·개발 예산의 상한을 정한다.", 0.6, ["downtime-cost"], "assumption"), check: { action: "챔버 시간당 가동 가치와 lot당 wafer 비용을 생산관리·재무에 확인", cost: "low" } },
      { when: ML, claim: h("모델 운영(PM 후 재보정, 재학습, 감시)의 인력 비용이 규칙 기반보다 크며 장비 수에 비례해 늘어난다.", 0.6, ["ml", "downtime-cost"], "assumption") },
    ],
    reviews: [
      { tags: ["ml"], stance: "refine", note: "재보정·재학습 인력 비용을 포함해야 규칙 기반과 비교할 수 있습니다." },
      { tags: ["baseline"], stance: "support", note: "가장 싼 대안부터 검증하는 순서가 비용 면에서도 맞습니다." },
    ],
    questions: [],
    risks: ["조사 비용이 손실 규모를 넘는데도 계속 진행되는 경우"],
  },
  "compat-scale": {
    summary: "한 챔버에서 맞은 해법이 다른 장비 모델·센서 구성·라인으로 넓어질 때 깨지는 지점을 찾습니다.",
    latencyMs: 850,
    rules: [
      { claim: h("MES/FDC 연동은 벤더 API와 SECS/GEM 구현 차이에 묶인다. 읽기 전용 export 파일부터 시작하면 장비 모델 간 차이를 흡수하기 쉽다.", 0.55, ["mes", "deployment"], "assumption") },
      { when: /여러|전체|fleet|라인|[0-9]+\s*대|확장/i, claim: h("장비 모델·센서 구성이 다르면 같은 FDC 파라미터 이름이 같은 물리량을 뜻하지 않는다. 확장 전 파라미터 매핑표가 필요하다.", 0.6, ["chamber-matching", "fdc"]), check: { action: "대상 장비 모델별 FDC 파라미터 매핑표 작성", cost: "medium" } },
    ],
    reviews: [{ tags: ["chamber-matching"], stance: "refine", note: "챔버 간 비교는 같은 장비 모델·센서 구성일 때만 바로 성립합니다." }],
    questions: ["처음 적용 범위는 챔버 1대인가, 같은 모델 전체인가?"],
    risks: [],
  },
};

function agentFor(lens: LensId, latency: number): LensAgent {
  const k = knowledge[lens];
  const wait = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (!latency) return resolve();
    const t = setTimeout(resolve, latency);
    signal.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
  });
  let mine: Claim[] = [];
  return {
    async explore(problem: Problem, { signal }): Promise<Exploration> {
      await wait(signal);
      const text = `${problem.title}\n${problem.statement}\n${problem.context ?? ""}`;
      const hits = k.rules.filter(r => !r.when || r.when.test(text));
      const claims = hits.map((r, i) => ({ id: `${lens}.${i + 1}`, ...r.claim }));
      mine = claims;
      const nextChecks = hits.flatMap((r, i) => r.check ? [{ ...r.check, resolves: [`${lens}.${i + 1}`] }] : []).map((c, i) => ({ id: `${lens}.c${i + 1}`, ...c }));
      return { summary: k.summary, claims, risks: k.risks, nextChecks, questions: k.questions };
    },
    async review(_problem: Problem, peers: PeerClaims[], { signal }) {
      await wait(signal);
      const ownTags = new Set(mine.flatMap(c => c.tags));
      return peers.flatMap(p => p.claims).flatMap(c => {
        const rule = k.reviews.find(r => (!r.tags || r.tags.some(t => c.tags.includes(t))) && (!r.kinds || r.kinds.includes(c.kind)) && (r.minConfidence === undefined || c.confidence >= r.minConfidence));
        if (rule) return [{ target: c.id, stance: rule.stance, note: rule.note }];
        const shared = c.tags.find(t => ownTags.has(t) && t !== "baseline");
        return shared ? [{ target: c.id, stance: "support" as const, note: `이 관점에서도 같은 신호(${shared})를 판단 근거로 봅니다.` }] : [];
      });
    },
  };
}

export function fixtureProvider(options: { simulateLatency?: boolean } = {}): AgentProvider {
  return { id: "fixture.semiconductor.v1", mode: "fixture", agent: lens => agentFor(lens.id, options.simulateLatency ? knowledge[lens.id].latencyMs : 0) };
}
