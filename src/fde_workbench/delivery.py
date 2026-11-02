"""Deterministic report/skill delivery; all output paths are explicitly supplied."""

from __future__ import annotations

import hashlib
import html
import json
import os
import tempfile
import zipfile
from importlib.resources import files
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .core import BRIEF_FIELDS, LABELS, check_design, language, render_brief


def json_bytes(data: Any) -> bytes:
    return (
        json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"
    ).encode()


def _report_html(pack: dict[str, Any], lang: str) -> str:
    language(lang)

    def esc(value: Any) -> str:
        return html.escape(str(value), quote=True)

    title = "Decision workspace" if lang == "en" else "설계 검토 워크스페이스"
    summary = (
        "Artifact checks passed · human review pending"
        if lang == "en"
        else "문서 구조 검사 통과 · 사람 검토 대기"
    )
    # Use the fixed contract ordering, never arbitrary JSON key order.
    brief = "".join(
        f'<section class="brief-row"><h3>{esc(label)}</h3><p>{esc(pack["brief"][key])}</p></section>'
        for label, key in zip(LABELS[lang], BRIEF_FIELDS, strict=True)
    )
    dispositions = (
        {"selected": "선택", "conditional": "조건부", "rejected": "기각"} if lang == "ko" else {}
    )
    alternatives = "".join(
        f'<article class="alternative"><span class="pill">{esc(dispositions.get(a["disposition"], a["disposition"]))}</span><h3>{esc(a["method"])}</h3><p>{esc(a["mechanism"])}</p><dl><dt>{"Why" if lang == "en" else "이유"}</dt><dd>{esc(a["reason"])}</dd><dt>{"Failure condition" if lang == "en" else "실패 조건"}</dt><dd>{esc(a["failsWhen"])}</dd></dl></article>'
        for a in pack["alternatives"]
    )
    critiques = "".join(
        f'<article><h3>{esc(c["lens"])}</h3><p>{esc(c["challenge"])}</p><p>{esc(c["response"])}</p><p class="muted">{esc(c["residualRisk"])}</p></article>'
        for c in pack["critiques"]
    )
    sources = []
    for source in pack["sources"]:
        url = urlsplit(source["url"])
        label = esc(source["id"])
        link = (
            f'<a rel="noreferrer" href="{esc(source["url"])}">{label}</a>'
            if url.scheme == "https" and url.hostname and not url.username
            else label
        )
        sources.append(
            f'<li>{link} <span class="muted">{esc(source["kind"])} · {esc(source["checkedAt"])}</span><p>{esc(source["supports"])}</p><p class="muted">{esc(source["limits"])}</p></li>'
        )
    headings = (
        ("Alternatives", "Critical review", "Evidence", "Operating boundaries")
        if lang == "en"
        else ("대안 비교", "비판 검토", "근거", "운영 경계")
    )
    operating_labels = (
        {
            "runtime": "실행 환경",
            "identityBoundary": "인증·권한 경계",
            "dataBoundary": "자료 경계",
            "capacityModel": "용량 가정",
            "failureRecovery": "오류 회복",
            "releaseRollback": "배포·롤백",
            "observability": "관측",
            "operatingOwner": "운영 책임",
        }
        if lang == "ko"
        else {}
    )
    deployment = "".join(
        f"<dt>{esc(operating_labels.get(key, key))}</dt><dd>{esc(value)}</dd>"
        for key, value in pack["deployment"].items()
    )
    footer = (
        "Offline review artifact · source truth and customer value require review."
        if lang == "en"
        else "오프라인 검토 자료 · 근거의 진실성과 사용자 가치는 별도 검토가 필요합니다."
    )
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>{esc(pack["id"])} · FDE Workbench</title><style>
:root{{color-scheme:light;--ink:#172932;--muted:#677c83;--accent:#087f74;--line:#dce6e6}}*{{box-sizing:border-box}}body{{margin:0;background:#f1f5f4;color:var(--ink);font:15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}main{{max-width:1080px;margin:auto;padding:48px 28px}}header{{padding:36px;border-radius:18px;background:#0c242a;color:white;margin-bottom:26px}}.eyebrow{{font-size:11px;letter-spacing:2px;color:#91d2c6}}h1{{font-size:40px;line-height:1.2;letter-spacing:-1.5px;margin:20px 0}}h2{{font-size:22px;margin:34px 0 18px}}h3{{font-size:15px;margin:0 0 8px}}.pill{{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;color:var(--accent);background:#e0f3ed}}header .pill{{background:#204344;color:#b3ead8}}.brief{{background:white;border:1px solid var(--line);border-radius:14px;padding:10px 28px}}.brief-row{{display:grid;grid-template-columns:180px 1fr;gap:20px;border-bottom:1px solid var(--line);padding:20px 0}}.brief-row:last-child{{border:0}}.brief-row p{{margin:0}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}article{{background:white;border:1px solid var(--line);border-radius:12px;padding:24px}}article .pill{{margin-bottom:14px}}p{{overflow-wrap:anywhere}}dt{{font-size:12px;font-weight:700;margin-top:14px}}dd{{margin:4px 0 0}}.muted{{color:var(--muted);font-size:13px}}a{{color:var(--accent)}}li{{margin:18px 0}}footer{{margin-top:36px;border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:12px}}@media(max-width:700px){{.grid{{grid-template-columns:1fr}}.brief-row{{grid-template-columns:1fr;gap:4px}}h1{{font-size:30px}}main{{padding:20px 14px}}header{{padding:25px}}}}@media print{{body{{background:white}}main{{padding:0}}header{{break-inside:avoid}}article,.brief-row{{break-inside:avoid}}}}
</style></head><body><main><header><div class="eyebrow">FDE / WORKBENCH</div><h1>{esc(pack["id"])}</h1><p>{esc(title)}</p><span class="pill">{esc(summary)}</span></header><section class="brief">{brief}</section><h2>{headings[0]}</h2><div class="grid">{alternatives}</div><h2>{headings[1]}</h2><div class="grid">{critiques}</div><h2>{headings[2]}</h2><ul>{"".join(sources)}</ul><details><summary>{headings[3]}</summary><dl>{deployment}</dl></details><footer>FDE Workbench · {footer}</footer></main></body></html>"""


def report_files(pack: dict[str, Any], lang: str = "en") -> dict[str, bytes]:
    result = check_design(pack)
    if result.status != "pass":
        raise ValueError("design is incomplete or invalid; run fde check before export")
    content = {
        "design.json": json_bytes(pack),
        "BRIEF.md": render_brief(pack, lang).encode(),
        "REPORT.html": _report_html(pack, lang).encode(),
        "CHECKS.json": json_bytes(result.to_dict()),
    }
    manifest = {
        "format": "fde.bundle.v1",
        "tool": "fde-workbench",
        "toolVersion": "0.2.0",
        "artifactHash": result.artifact_hash,
        "language": lang,
        "validationScope": "design_artifact_only",
        "humanReview": "not_run",
        "files": {name: hashlib.sha256(data).hexdigest() for name, data in sorted(content.items())},
    }
    content["manifest.json"] = json_bytes(manifest)
    return content


def _write_directory(destination: Path, content: dict[str, bytes]) -> Path:
    destination = Path(destination)
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(f"destination already exists: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Temporary sibling and rename keep failed writes away from the destination.
    with tempfile.TemporaryDirectory(prefix=".fde-", dir=destination.parent) as temp:
        staged = Path(temp) / "artifact"
        staged.mkdir()
        for name, data in content.items():
            target = staged / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        # Reserve the output name atomically; never replace another writer's directory.
        destination.mkdir()
        try:
            for item in staged.iterdir():
                os.replace(item, destination / item.name)
        except BaseException:
            # Only this process's newly created directory is affected.
            import shutil

            shutil.rmtree(destination)
            raise
    return destination


def _write_zip(destination: Path, content: dict[str, bytes]) -> Path:
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with (
        destination.open("xb") as stream,
        zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive,
    ):
        for name, data in sorted(content.items()):
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return destination


def export_report(pack: dict[str, Any], output: Path, lang: str = "en") -> Path:
    """Write a reviewable offline report to a new directory."""
    return _write_directory(output, report_files(pack, lang))


def make_bundle(pack: dict[str, Any], output: Path, lang: str = "en") -> Path:
    """Create a deterministic ZIP. Existing files are never overwritten."""
    return _write_zip(output, report_files(pack, lang))


def skill_files() -> dict[str, bytes]:
    base = files("fde_workbench").joinpath("resources", "skill")
    content: dict[str, bytes] = {}

    def walk(node: Any, prefix: str = "") -> None:
        for item in sorted(node.iterdir(), key=lambda x: x.name):
            name = prefix + item.name
            if item.is_dir():
                walk(item, name + "/")
            else:
                content[name] = item.read_bytes()

    walk(base)
    manifest = {
        "name": "fde-workbench",
        "version": "0.2.0",
        "files": {name: hashlib.sha256(data).hexdigest() for name, data in sorted(content.items())},
    }
    content["manifest.json"] = json_bytes(manifest)
    return content


def install_skill(directory: Path) -> Path:
    """Install only into the explicitly chosen directory; change no host config."""
    return _write_directory(Path(directory) / "fde-workbench", skill_files())


def build_skill(output: Path) -> Path:
    return _write_zip(
        output, {"fde-workbench/" + name: data for name, data in skill_files().items()}
    )
