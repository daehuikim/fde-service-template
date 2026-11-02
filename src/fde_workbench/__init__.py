"""Portable, offline problem-design tools. No model calls or telemetry."""

from .core import CheckResult, check_design, new_design, render_brief
from .delivery import export_report, install_skill, make_bundle

__version__ = "0.2.0"
__all__ = [
    "CheckResult",
    "check_design",
    "new_design",
    "render_brief",
    "export_report",
    "make_bundle",
    "install_skill",
]
