# 릴리스와 배포

[English](../en/releasing.md) · [한국어](releasing.md)

MIT 라이선스의 Python wheel·소스 배포본·skill ZIP을 제공합니다. 0.2.0은 beta 릴리스입니다. 패키지가 정상 설치된다는 사실과 현장 설계의 효과는 별도로 검증합니다.

```sh
uv sync --frozen
uv run ruff check src tests
uv run ruff format --check src tests
uv run pytest
uv build
uv run twine check dist/*
uv run python scripts/package-smoke.py
uv run python scripts/release-artifacts.py
```

깨끗한 `dist/`에서 시작합니다. smoke test는 저장소 밖의 독립 가상환경에 wheel을 설치하고 한·영 CLI, 보고서, ZIP, skill 자원을 확인합니다. 릴리스에는 wheel·sdist·skill ZIP·SHA256SUMS를 첨부합니다. 고객 데이터는 포함하지 않습니다.

GitHub CI는 Linux의 Python3.10–3.13, macOS/Windows의 Python3.12를 검사합니다. 실패/미실시 환경을 통과했다고 보고하지 않습니다. 검토된 commit을 버전 tag로 고정한 뒤 GitHub Release에 배포물을 붙입니다.

## PyPI 연결

`publish-pypi.yml`은 수동 실행이며 `pypi` environment와 OIDC trusted publisher를 사용합니다. 토큰을 저장소에 넣지 않습니다. 최초 게시는 소유자가 PyPI 배포명/신뢰할 GitHub publisher와 environment를 연결해야 합니다. 이후 검토된 tag로 실행하면 버전 일치·테스트·독립 설치·빌드를 거쳐 업로드합니다. 일반 CI나 `fde` 명령은 PyPI에 게시하지 않습니다.

[0.2.0은 PyPI에 게시되었습니다](https://pypi.org/project/fde-workbench/0.2.0/). [배포 실행 41465806817의 두 번째 시도](https://github.com/daehuikim/fde-service-template/actions/runs/41465806817/attempts/2)가 성공했고, PyPI에서 새 환경에 설치한 뒤 `fde doctor` 통과를 확인했습니다. [공식 가이드](https://docs.pypi.org/trusted-publishers/)

첫 시도는 업로드 전 디지털 서명 생성 중 Rekor의 HTTP 502로 실패했습니다. publisher 설정과 서명을 유지한 채 실패한 job을 재실행해 성공했습니다. 같은 오류라면 업로드 여부를 먼저 확인하고 재시도합니다. 성공한 배포물을 덮어쓰지 않습니다. 인증·publisher 정보 오류는 별도로 원인을 확인합니다.

## 업그레이드와 한계

설계 계약은 `fde.design.v1`을 유지합니다. Python은 실제 날짜/URL 검사와 CLI의 JSON 키·입력 크기 제한을 더 엄격하게 적용합니다. 업그레이드 전 기록을 보존하고, 문제가 있으면 직전 고정 버전으로 되돌립니다. 기존 skill 폴더는 자동 교체하지 않습니다.

코어는 설계 문서 검사·배포 도구입니다. 자동 조사·근거 진실성 판단·provider 호출·호스팅 서비스는 제공하지 않습니다. skill은 호스트의 모델/도구/권한을 이용합니다. 실제 사용자 가치와 서비스 운영 효과는 별도 평가가 필요합니다.
