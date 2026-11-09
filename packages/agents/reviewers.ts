// Built-in round-3 reviewers. Plain data so the UI can label them without loading the runner.
export const builtInReviewers = [
  { id: "structural", title: "구조 검증", focus: "보고서 기록이 내부적으로 맞는가: 관점 누락·실패, 판별 수단 없는 쟁점, 근거 없는 관측, 침묵한 관점, 반대 없는 합의" },
  { id: "comprehension", title: "처음 읽는 사람", focus: "보고서만 읽고 결론과 첫 조치를 다시 말할 수 있는가, 정의 없는 약어·끊긴 참조는 없는가" },
  { id: "zoom-out", title: "관점 이탈", focus: "문제에 나온 조건(폐쇄망, ML, 수율, 확장)을 다룰 관점이 빠지지 않았는가" },
] as const;
