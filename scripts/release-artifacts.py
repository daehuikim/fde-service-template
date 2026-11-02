"""Build skill assets and hash the release files. Does not publish anything."""

from __future__ import annotations

import hashlib
from pathlib import Path

from fde_workbench import __version__
from fde_workbench.delivery import build_skill

out = Path("dist")
out.mkdir(exist_ok=True)
skill = out / f"fde-workbench-skill-{__version__}.zip"
if skill.exists():
    raise SystemExit(f"Existing artifact: {skill}; use a clean dist directory")
build_skill(skill)
paths = sorted(p for p in out.iterdir() if p.suffix in (".whl", ".gz", ".zip"))
(out / "SHA256SUMS").write_text(
    "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths),
    encoding="utf-8",
)
print(f"prepared {len(paths)} artifacts + SHA256SUMS; no upload performed")
