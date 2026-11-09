// Each lens is one exploration agent bound to an existing project skill. The skill file is the agent's procedure;
// the question is what that agent must answer about the shared problem packet.
import type { LensId } from "../contracts/discussion";

export interface Lens { id: LensId; skill: string; title: string; question: string }
export const lensCatalog: Record<LensId, Lens> = {
  "discovery": { id: "discovery", skill: "fde-discovery", title: "현장 업무 · baseline", question: "누가 어떤 결정을 바꾸는가, 지금은 어떻게 하고 있는가" },
  "field-debug": { id: "field-debug", skill: "fde-field-debug", title: "원인 가설 · 차이 소거", question: "정상과 이상의 차이는 무엇이고, 가장 싼 소거 순서는" },
  "problem-design": { id: "problem-design", skill: "fde-problem-design", title: "접근 방법 비교", question: "규칙·통계·모델·사람 중 무엇을 먼저 검증할 것인가" },
  "validation": { id: "validation", skill: "fde-validation-review", title: "검증 타당성", question: "제안된 확인이 주장을 실제로 증명하는가" },
  "security": { id: "security", skill: "fde-security-review", title: "데이터 경계 · 보안", question: "어떤 데이터가 어디로 이동하고, 무엇이 반출 불가인가" },
  "target-env": { id: "target-env", skill: "fde-target-env", title: "현장 배포 환경", question: "고객 망·OS·장비 제약에서 어디에 어떻게 설치하는가" },
  "cost": { id: "cost", skill: "fde-cost-model", title: "비용 · 손실", question: "다운타임·폐기 손실 대비 조사·운영 비용은" },
  "compat-scale": { id: "compat-scale", skill: "fde-compat-scale-review", title: "호환성 · 확장", question: "다른 장비·라인으로 넓힐 때 무엇이 깨지는가" },
};
// Fab troubleshooting starts from what changes a decision, why it happens, which method, whether the proof holds, and what data may move.
export const defaultLenses: LensId[] = ["discovery", "field-debug", "problem-design", "validation", "security"];

// Goldfish reviewers the skill runs in round 3. Each is a fresh subagent that sees only the report and the problem
// packet. This list labels them in the UI; their prompts live in the skill's references/prompts.md.
export const goldfishCatalog: Record<string, { title: string; focus: string }> = {
  "structural": { title: "구조 검증", focus: "보고서 안에서 앞뒤가 맞는가: 실패·침묵한 관점, 판별 수단 없는 쟁점, 근거 없는 관측, 반대 없는 합의" },
  "comprehension": { title: "처음 읽는 사람", focus: "보고서만 읽고 결론과 첫 조치를 다시 말할 수 있는가, 정의 없는 용어는 없는가" },
  "zoom-out": { title: "관점 이탈", focus: "문제의 조건(폐쇄망, ML, 수율, 확장)을 다룰 관점이 빠지지 않았는가, 근본 문제를 보고 있는가" },
  "design-critic": { title: "논증 비판", focus: "결론과 순위가 기록된 주장·반대 의견에서 실제로 따라 나오는가" },
  "implementation-readiness": { title: "현장 실행 가능성", focus: "첫 확인을 데이터 위치·담당·소요까지 정해 바로 실행할 수 있는가" },
};
