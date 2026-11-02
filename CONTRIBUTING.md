# 기여

새 문제는 docs/problem-brief.md의 업무/대안/성공 조건부터 설명해 주세요. `codex/주제` 또는 짧은 feature branch에서 변경하고 실제 작업 단위의 Conventional Commit을 남깁니다.

PR 전 `pnpm qa`, `pnpm eval:fixture`, `pnpm security:scan`을 실행하고 DB 변경은 `pnpm test:db`를 추가합니다. 미실시는 blocked/not_run과 이유를 적습니다. 계약/배포 변경은 ADR과 architecture.spec.json을 함께 갱신합니다. 실제 사용자 데이터 대신 합성 사례를 기여해 주세요. 외부 자료는 출처·revision·license를 기록합니다.
