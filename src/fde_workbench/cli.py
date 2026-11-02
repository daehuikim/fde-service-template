"""The fde command-line interface. Exit codes: 0 pass, 1 invalid design, 2 usage/I/O."""

from __future__ import annotations

import argparse
import json
import sys
from importlib.metadata import version
from pathlib import Path
from typing import Any

from . import __version__
from .core import MAX_INPUT_BYTES, check_design, new_design, render_brief, resource_text
from .delivery import (
    _write_directory,
    build_skill,
    export_report,
    install_skill,
    json_bytes,
    make_bundle,
)


def load_design(path: Path) -> dict[str, Any]:
    path = path / "design.json" if path.is_dir() else path
    with path.open("rb") as stream:
        raw = stream.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ValueError("input exceeds 2 MB")

    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate JSON key: " + key)
            result[key] = value
        return result

    data = json.loads(
        raw,
        object_pairs_hook=pairs,
        parse_constant=lambda value: (_ for _ in ()).throw(ValueError("non-finite JSON value")),
    )
    if not isinstance(data, dict):
        raise ValueError("design must be a JSON object")
    return data


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="fde", description="Evidence-led problem design. Offline by default."
    )
    p.add_argument("--version", action="version", version=f"fde-workbench {__version__}")
    sub = p.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init", help="create an incomplete design workspace")
    init.add_argument("output", type=Path)
    init.add_argument("--id")
    init.add_argument("--problem", default="")
    init.add_argument("--lang", choices=("en", "ko"), default="en")
    ex = sub.add_parser("example", help="copy a complete, explicitly synthetic example")
    ex.add_argument("name", choices=("support-triage",))
    ex.add_argument("--output", required=True, type=Path)
    ex.add_argument("--lang", choices=("en", "ko"), default="en")
    check = sub.add_parser("check", help="validate schema and evidence traceability")
    check.add_argument("path", type=Path)
    check.add_argument("--json", action="store_true")
    brief = sub.add_parser(
        "brief", help="render a short review brief before the full design is ready"
    )
    brief.add_argument("path", type=Path)
    brief.add_argument("--lang", choices=("en", "ko"), default="en")
    brief.add_argument("--output", type=Path)
    for name, help_text in (
        ("export", "export an offline HTML/Markdown report"),
        ("bundle", "create a deterministic handoff ZIP"),
    ):
        cmd = sub.add_parser(name, help=help_text)
        cmd.add_argument("path", type=Path)
        cmd.add_argument("--output", required=True, type=Path)
        cmd.add_argument("--lang", choices=("en", "ko"), default="en")
    evaluate = sub.add_parser(
        "evaluate", help="check several designs; failed inputs remain in the denominator"
    )
    evaluate.add_argument("paths", nargs="+", type=Path)
    skill = sub.add_parser("skill", help="install or package the portable skill")
    skills = skill.add_subparsers(dest="skill_command", required=True)
    install = skills.add_parser("install")
    install.add_argument("--directory", required=True, type=Path)
    build = skills.add_parser("build")
    build.add_argument("--output", required=True, type=Path)
    sub.add_parser("doctor", help="inspect the local package and bundled resources")
    schema = sub.add_parser("schema", help="print the bundled design contract")
    schema.add_argument("--output", type=Path)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "init":
            identifier = args.id or args.output.name
            draft = new_design(identifier, args.problem)
            readme = (
                "# Design workspace\n\nStart with the brief, compare alternatives, then record evidence and critiques. A new draft intentionally fails `fde check`.\n"
                if args.lang == "en"
                else "# 설계 워크스페이스\n\n짧은 초안부터 작성하고 대안·근거·비판을 추가하세요. 새 초안은 `fde check`에 실패하는 것이 정상입니다.\n"
            )
            print(
                _write_directory(
                    args.output, {"design.json": json_bytes(draft), "README.md": readme.encode()}
                )
            )
        elif args.command == "example":
            content = resource_text(f"examples/{args.name}.{args.lang}.json")
            print(_write_directory(args.output, {"design.json": content.encode()}))
        elif args.command == "check":
            result = check_design(load_design(args.path))
            if args.json:
                print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
            else:
                print(f"{result.status.upper()} · design artifact only")
                for error in result.errors:
                    print("  " + error)
                if not result.errors:
                    print(
                        "Traceability checks passed. Source truth, method suitability and user value need review."
                    )
            return 0 if result.status == "pass" else 1
        elif args.command == "brief":
            output = render_brief(load_design(args.path), args.lang)
            if args.output:
                with args.output.open("x", encoding="utf-8") as stream:
                    stream.write(output)
                print(args.output)
            else:
                print(output, end="")
        elif args.command in ("export", "bundle"):
            operation = export_report if args.command == "export" else make_bundle
            print(operation(load_design(args.path), args.output, args.lang))
        elif args.command == "evaluate":
            results = []
            for path in args.paths:
                try:
                    results.append(
                        {"input": str(path), **check_design(load_design(path)).to_dict()}
                    )
                except (OSError, ValueError, RecursionError) as exc:
                    results.append({"input": str(path), "status": "fail", "errors": [str(exc)]})
            print(
                json.dumps(
                    {
                        "scope": "design_artifact_only",
                        "passed": sum(r["status"] == "pass" for r in results),
                        "total": len(results),
                        "results": results,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0 if all(r["status"] == "pass" for r in results) else 1
        elif args.command == "skill":
            print(
                install_skill(args.directory)
                if args.skill_command == "install"
                else build_skill(args.output)
            )
        elif args.command == "doctor":
            print(
                json.dumps(
                    {
                        "version": __version__,
                        "python": sys.version.split()[0],
                        "jsonschema": version("jsonschema"),
                        "schema": json.loads(resource_text("design.schema.json"))["$id"],
                        "network": "not used",
                        "telemetry": False,
                    },
                    indent=2,
                )
            )
        elif args.command == "schema":
            text = resource_text("design.schema.json")
            if args.output:
                with args.output.open("x", encoding="utf-8") as stream:
                    stream.write(text)
            else:
                print(text, end="")
        return 0
    except (OSError, ValueError, RecursionError) as exc:
        print(f"fde: {exc}", file=sys.stderr)
        return 2
