# CLI·Python API

[English](../en/api.md) · [한국어](api.md) · [가이드](guide.md)

주요 명령은 `init`, `example`, `check`, `brief`, `export`, `bundle`, `evaluate`, `skill install/build`, `schema`, `doctor`입니다. 각 명령의 `--help`와 [전체 명령 표](../en/api.md)를 확인하세요.

종료 코드는 성공 **0**, 설계/평가 실패 **1**, 사용법·잘못된 JSON·입출력 오류 **2**입니다. 입력은 2 MB로 제한하며 중복 JSON 키와 NaN/Infinity를 거부합니다. 기존 결과물을 덮어쓰지 않습니다.

```python
from fde_workbench import new_design, check_design, render_brief

pack = new_design("request-routing", problem="요청별 담당자를 어떻게 정할까?")
result = check_design(pack)  # 새 초안이므로 fail
print(result.to_dict())
```

`check_design`은 상태·오류·지표·canonical content hash·검사 범위와 한계를 반환합니다. 해시는 같은 내용을 식별하며 진실성이나 서명을 보증하지 않습니다. `render_brief(pack, lang="ko")`는 짧은 Markdown을, `export_report`와 `make_bundle`은 전체 설계를 검사한 뒤 결과 경로를 반환합니다. `install_skill`은 명시한 설치 폴더에만 씁니다. 패키지에 `py.typed`가 포함됩니다.

Python 코어는 근거 URL을 수집하거나 provider를 호출하거나 데이터를 업로드하지 않습니다. 호스트 어시스턴트의 행동은 해당 호스트의 권한 정책을 따릅니다.
