# 공식 현장 사례 비교 · 2026-11-02

| 사례 | 공식 자료가 보여주는 업무 | 데이터 확보 | 이번 검토의 범위 |
|---|---|---|---|
| EV 충전소 입지 | [Palantir 공식 사례](https://www.palantir.com/docs/foundry/use-case-examples/improving-profitability-of-ev-chargepoints-through-integrated-location-optimization): 여러 정보원을 결합해 입지를 평가하는 업무 | [NLR/AFDC API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/) 8건. 비용/수요/계통 자료는 없음 | 조사 shortlist 설계, 조합 최적화 도입 조건, 불확실성/근거 부족 처리 |
| 파트너 QA | [Sendbird 경로의 롯데 사례](https://sendbird.com/resources/lotte-homeshopping), [Anthropic 사례](https://www.anthropic.com/customers/lotte-homeshopping): 반복 문의/문서 확인과 접근 관리 | 비공개 원문 없음. 정책/질문을 작은 synthetic fixture로만 작성 | FAQ/검색/선택적 LLM/자동 action의 역할 구분과 handoff 설계 |
| ERP 기반 생산/원료 검토 | [Palantir 공식 사례](https://www.palantir.com/docs/foundry/use-case-examples/optimizing-production-with-erp-data-across-the-supply-chain): 여러 ERP를 연결해 원료/생산 판단 지원 | 고객 ERP/BOM/원가/수요 원본은 없음 | 전이 가능한 설계 원칙만 검토. 독립적인 완전한 검증 사례로 집계하지 않음 |

이들은 실제 업무를 설명하는 공개 사례이며 우리 고객 업무를 관찰한 결과는 아니다. Palantir/Sendbird/Anthropic의 성과 수치를 복사해 우리 template의 성능으로 쓰지 않는다. Sendbird 링크는 확인 시 delight.ai 고객 페이지로 redirect되었다. 동일 고객의 복수 vendor 자료는 독립 검증 근거가 아니다.

Firecrawl search는 timeout되어 일반 웹 검색과 공식 API로 조사했다. 원문 전체·이미지·로고는 재배포하지 않고 요약과 링크만 제공한다.
