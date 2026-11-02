# Third-party notices

자체 코드는 MIT입니다. 외부 자료는 각 라이선스를 따릅니다. 제품명은 해당 소유자의 상표이며 제휴를 의미하지 않습니다.

| 자료 | 고정 revision | 라이선스 | 포함 상태 |
|---|---|---|---|
| frontend-design | `ca45fc496a3436251f191354091d557da31c15b5` | Apache-2.0 | installed-reference-only |
| supabase-postgres-best-practices | `c9be0e931b7930f7d02126d04774d904c381e7d7` | MIT | installed-reference-only |
| copywriting | `88c79f6528a9347420e57ceb1fff9a60de651768` | MIT | installed-reference-only |
| copy-editing | `88c79f6528a9347420e57ceb1fff9a60de651768` | MIT | installed-reference-only |
| vercel-react-best-practices | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | MIT declared in SKILL.md; full notice not found | reviewed-not-vendored |
| stack-diagram | `9e90a3b286baa6eef9700ca01abb80dbf0ad1514` | MIT + bundled font OFL-1.1 | curated-local-adaptation |

외부 skill의 references/assets/scripts는 선택한 디렉터리 전체를 보존합니다. 설치는 참고 자료 제공이며 포함된 임의 shell hook이나 배포 도구를 실행한 것이 아닙니다. marketing skills는 root MIT notice를 UPSTREAM-LICENSE로, Supabase도 root notice를 함께 보존합니다. Anthropic frontend-design은 자체 LICENSE.txt(Apache-2.0)를 보존합니다. frontend-design은 복사본을 수정하지 않았습니다.

stack-diagram은 로컬 정책에 맞게 SKILL.md를 대체했고, build.py/geometry/template/generic assets/fonts만 보존했습니다. 원본 MIT는 .agents/skills/stack-diagram/LICENSE에 있습니다. gallery/share/render/fetch 기능은 설치하지 않았습니다. 도식의 레이어/배포 SVG 생성기는 자체 코드입니다.

## 폰트/figure asset ledger

| 자산 | 출처/버전 | 라이선스/저작자 | 사용/수정 |
|---|---|---|---|
| Pretendard Regular | [orioncactus/pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9) | SIL OFL 1.1, 길형진/기여자 | HTML 한국어 glyph, 원본 woff2와 OFL 보존 |
| Geist | stack-diagram pin의 fonts | SIL OFL 1.1, Vercel | upstream asset 보존, 현재 figure에서 미사용 |
| JetBrains Mono | stack-diagram pin의 fonts | SIL OFL 1.1, JetBrains | upstream asset 보존, 현재 figure에서 미사용 |
| generic SVG | stack-diagram pin의 assets/generic | upstream MIT | 보존, 현재 figure에서 미사용 |
| layers/deployment SVG | 자체 spec 기반 | 자체 MIT | 생성 figure, 외부 로고 없음 |

취득/검토일: 2026-11-02. 파일별 SHA-256은 config/tools.lock.json 및 docs/architecture/asset-ledger.json에 기록합니다. 웹 사용과 원본 재배포 조건을 따로 확인합니다. 사진/브랜드 로고/고객 자료는 포함하지 않습니다.

## 런타임/개발 의존성

Next.js/React/csv-parse/AJV/Postgres.js/TypeScript/tsx/Vitest 등은 pnpm-lock.yaml에 정확한 version과 integrity를 기록합니다. package manager 설치 후 각 패키지 LICENSE를 확인할 수 있습니다. node_modules를 저장소에 재배포하지 않습니다. 선택 MCP는 config/tools.manifest.json의 root version만 고정하며 아직 설치/인증/연결 검증하지 않았습니다.
