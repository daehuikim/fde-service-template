# UI 설계 근거

작업 중심의 2열 input/review 화면. 예제의 오류를 숨기지 않고 사용자가 원문을 정정하게 한다. 검증 중 입력을 잠그고 취소 시 입력과 이전 결과를 보존한다. 결과에는 행·필드·code와 parser/validator 근거를 표시한다. export는 JSON만 지원하며 CSV 수식 injection 경로를 만들지 않는다.

시각 방향: 업무용 SaaS, 차분한 녹색 navigation과 밝은 작업면. system Korean font를 기본으로 사용한다. diagram에는 Pretendard v1.3.9를 자체 포함한다. 버튼은 직접 작성한 native component이며 shadcn/ui가 설치되었다고 주장하지 않는다. 향후 shadcn 적용 시 copy한 component·license·revision을 ledger에 추가한다.

참조(2026-11-02): [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying) → standalone 배포 방식; [stack-diagram](https://github.com/caru-ini/stack-diagram/tree/9e90a3b286baa6eef9700ca01abb80dbf0ad1514) → 계층/배포 도식의 geometry와 offline build; 사용자 첨부 그림 → 계층 책임/납품 matrix 구조를 범용 template에 맞게 재구성. 외부 UI를 그대로 복제하지 않았다.

검증: 정적 타입/API/업무 테스트 실행. 키보드·모바일·screen reader·실제 사용자 관찰은 not_run이며 브라우저 허용 후 검토한다. 로딩/실패/취소/완료 카피는 구현되어 있다.
