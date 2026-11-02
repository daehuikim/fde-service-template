# 운영 관측과 보안 요구

현재 구현: 입력 200 KB/1,000행 한도, CSV record 크기 한도, request abort 전달, 서버 bearer 검증, production fixture 차단, RLS transaction context, 멱등 키/내용 hash, 공개 데이터 없는 합성 예제.

미구현 운영 게이트: 사람용 OIDC/session/CSRF 설계, IP/subject rate limiting, 중앙 audit log, 지표/추적 exporter, DB readiness, alert routing, 자동 backup, 취약점 정기 검사. bearer token은 server-to-server/API client용이며 브라우저 localStorage에 저장하지 않습니다. RLS는 tenant isolation이며 tenant 회원 인증을 대신하지 않습니다.

운영 시 수집할 지표는 request ID, endpoint, status, duration, schema rejection code, adapter timeout, DB pool wait, retry/conflict 횟수입니다. 원본 CSV, token, 요청 제목, DSN은 로그로 남기지 않습니다. trace/evidence를 클라이언트가 제출해 저장하지 않고 서버가 재검증합니다. 외부 문서·도구 응답은 비신뢰 데이터입니다.

ASVS 매핑(요구사항 선정안): 입력 검증 → contracts/API QA; 인증 → bearer 경계 테스트; 접근 제어 → PostgreSQL RLS integration; 오류/로그 → generic error, 원본 미기록; 데이터 보호 → 전송 TLS/backup 현장 설정. 특정 ASVS 버전의 번호별 인증을 주장하지 않습니다. 적용 서비스의 버전을 고정하고 실제 증거를 연결한 후 검토하세요.

성능 기준: k6 10 VU/20초/1행 요청, 실패율 <1%, p95 <1초는 초기 smoke gate입니다. 제품 SLO가 아닙니다. 측정 환경·Git SHA·pool wait·데이터 크기별 결과를 별도 기록해야 합니다.
