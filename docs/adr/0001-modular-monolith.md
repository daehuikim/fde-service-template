# ADR 0001 · 작은 모듈형 모놀리스

상태: 채택 · 2026-11-02

독립 배포 요구가 확인되지 않은 범용 시작점이다. Next.js 화면/API를 하나의 런타임으로 배포하고 contracts, domain, tools, db를 책임으로 구분한다. domain은 app/db를 import하지 않고 tools는 domain을 호출한다. 기본 경로는 LLM·queue·cache 없이 결정적으로 실행한다.

대안: 별도 gateway, agent, worker를 처음부터 배포하면 인증/계약/관측/운영 부담이 늘어난다. 실행 시간과 확장 요구가 관측되면 분리를 재검토한다. tenant별 별도 fork 대신 DB tenant 경계와 검토한 설정을 사용한다. 운영 인증/UI 연결은 서비스별로 선택한다.

결과: fixture로 키 없이 작업을 검증할 수 있다. production fixture 차단으로 데모를 운영 서비스로 오인하지 않는다. 배포 설정이 있다는 사실과 운영 검증을 마쳤다는 사실을 구분한다.
