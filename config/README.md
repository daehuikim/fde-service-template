# 개발 도구 profile

`pnpm setup:tools --profile restricted-assignment`는 repo에 포함된 skills와 policy를 선택하고 무시되는 `config/local/profile.json`만 씁니다. 전역 Codex/MCP 설정을 덮어쓰지 않고 원격 도구·hooks·브라우저를 실행하지 않습니다.

Codex 예제는 `codex.example.toml`에 있으며 서버는 모두 enabled=false입니다. 사용자는 검토 후 신뢰하는 프로젝트의 `.codex/config.toml`에 필요한 항목만 병합합니다. 범용 MCP JSON은 클라이언트마다 disable 방식이 달라 기본 서버 목록을 비워 두었습니다. 활성화할 서버의 command/args/env 이름만 클라이언트 문서에 맞게 추가합니다. 키 값은 Git에 넣지 않습니다.

선택형 개발 도구: Firecrawl(공개 문서 수집, API key/네트워크), Context7(버전별 문서, 네트워크), shadcn MCP(component 탐색, 네트워크). 현재 실제 MCP 연결 검증은 not_run입니다. 제품 runtime은 이 MCP에 의존하지 않습니다. npx 버전 pin은 root package 버전을 고정하지만 원격 SaaS 응답과 transitive dependency 전체 재현을 보장하지 않습니다. 사용 전 별도 dependency lock을 생성하고 외부 전송 범위를 검토하세요.

정확한 skill revision·파일 hash·license는 tools.lock.json에 있습니다. 기본 design 참고는 frontend-design(Apache-2.0)입니다. 작은 제품 작업의 시각/카피 원칙을 제공하므로 선택했으며 Impeccable은 중복 설치하지 않았습니다. React review는 Vercel upstream URL로 남겼고 full license notice 확인 전 재배포하지 않았습니다. 외부 skill의 배포/외부 전송/브라우저 지시는 프로젝트 policy를 우회하지 못합니다.

자료: [공식 Codex MCP](https://learn.chatgpt.com/docs/extend/mcp), [설정 reference](https://learn.chatgpt.com/docs/config-file/config-reference), [Firecrawl](https://github.com/firecrawl/firecrawl-mcp-server), [Context7](https://github.com/upstash/context7), [shadcn MCP](https://ui.shadcn.com/docs/mcp). 확인일 2026-11-02.
