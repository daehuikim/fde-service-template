"""Install the built wheel outside the checkout and exercise its shipped resources."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import venv
from pathlib import Path

root = Path(__file__).resolve().parent.parent
wheels = list((root / "dist").glob("fde_workbench-*-py3-none-any.whl"))
if len(wheels) != 1:
    raise SystemExit("Expected one built wheel in dist/")
with tempfile.TemporaryDirectory(prefix="fde-wheel-") as temporary:
    workspace = Path(temporary)
    venv.EnvBuilder(with_pip=True).create(workspace / "env")
    binary = workspace / "env" / ("Scripts" if os.name == "nt" else "bin")
    python = binary / ("python.exe" if os.name == "nt" else "python")
    command = binary / ("fde.exe" if os.name == "nt" else "fde")
    env = {**os.environ, "PYTHONUTF8": "1"}
    env.pop("PYTHONPATH", None)
    subprocess.run(
        [str(python), "-m", "pip", "install", "--disable-pip-version-check", str(wheels[0])],
        check=True,
        cwd=workspace,
        env=env,
    )

    def run(*args: str) -> str:
        return subprocess.run(
            [str(command), *args],
            check=True,
            cwd=workspace,
            env=env,
            text=True,
            capture_output=True,
            encoding="utf-8",
        ).stdout

    run("doctor")
    for lang in ("en", "ko"):
        run("example", "support-triage", "--output", f"demo-{lang}", "--lang", lang)
        assert json.loads(run("check", f"demo-{lang}", "--json"))["status"] == "pass"
        run("brief", f"demo-{lang}", "--lang", lang)
        run("export", f"demo-{lang}", "--output", f"report-{lang}", "--lang", lang)
        run("bundle", f"demo-{lang}", "--output", f"handoff-{lang}.zip", "--lang", lang)
        assert (workspace / f"report-{lang}" / "REPORT.html").exists()
    run("skill", "install", "--directory", "agent-skills")
    run("skill", "build", "--output", "skill.zip")
    assert (workspace / "agent-skills/fde-workbench/references/design.schema.json").exists()
    print("pass: isolated wheel installation, bilingual CLI, reports, bundles and skill resources")
