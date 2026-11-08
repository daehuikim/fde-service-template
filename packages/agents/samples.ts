// Synthetic fab problems for the demo UI, CLI and tests. No real site, tool or customer data.
import type { LensId, Problem } from "../contracts/discussion";

export const samples: { id: string; label: string; lenses: LensId[]; problem: Problem }[] = [
  { id: "cvd-particle", label: "PM 후 파티클 증가", lenses: ["discovery", "field-debug", "problem-design", "validation", "security"], problem: { title: "PECVD 3호기 챔버 B 파티클 excursion", statement: "지난 2주간 PECVD 3호기 챔버 B에서 particle adder가 기준 대비 약 3배 증가했습니다. PM 이후 시작된 것으로 보이며 같은 레시피를 쓰는 챔버 A는 정상입니다. FDC 알람은 발생하지 않았고, 엔지니어가 SPC 차트와 장비 로그를 수동으로 대조하고 있습니다.", context: "합성 예제 · 결함 맵과 FDC 트레이스는 고객 망 안에서만 조회 가능" } },
  { id: "etch-cd-drift", label: "식각 CD 드리프트 · ML 제안", lenses: ["discovery", "field-debug", "problem-design", "validation", "security", "cost", "compat-scale"], problem: { title: "Etch CD 드리프트와 수율 하락", statement: "Etch 공정 후 CD가 lot마다 서서히 커지고 최종 수율이 1.5%p 하락했습니다. 고객 측은 ML 가상 계측(VM)으로 CD를 예측하자고 제안했습니다. 데이터는 MES와 FDC에 있고 사외 반출이 불가한 폐쇄망입니다. 같은 모델 장비 6대 중 2대에서 두드러집니다.", context: "합성 예제 · wet clean 주기와 RF hour 기록 있음" } },
  { id: "airgap-install", label: "폐쇄망 설치 실패", lenses: ["field-debug", "target-env", "security", "validation"], problem: { title: "분석 서버 설치가 고객 폐쇄망에서만 실패", statement: "우리 CI와 사내 테스트 서버에서는 정상 동작하는 결함 분석 서버가 고객 fab 폐쇄망의 분석 서버에 설치한 뒤 MES 데이터 수집 단계에서 TLS 오류로 실패합니다. 고객 서버는 사내 프록시와 사내 CA를 사용합니다.", context: "합성 예제 · 고객이 env-probe 결과 제공 가능" } },
];
