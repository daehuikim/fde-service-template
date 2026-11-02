"""Schema and traceability checks for design artifacts, not business correctness."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import date
from importlib.resources import files
from typing import Any
from urllib.parse import urlsplit

from jsonschema import Draft7Validator

MAX_INPUT_BYTES = 2_000_000
BRIEF_FIELDS = (
    "background",
    "painPoint",
    "valueHypothesis",
    "technicalCombination",
    "scaleTrigger",
    "weaknessCounterargument",
    "nextCheck",
)
LABELS = {
    "en": (
        "Background",
        "Pain point",
        "Value hypothesis",
        "Technical approach",
        "Scale triggers",
        "Weakness & counterargument",
        "Next check",
    ),
    "ko": (
        "배경",
        "페인포인트",
        "소구점 · 기대 이득(가설)",
        "기술 조합 · 선택 이유",
        "확장 조건",
        "취약점 · 반론",
        "다음 확인",
    ),
}
LIMITS = (
    "Source references do not prove that a claim is true.",
    "Method suitability and user value require human review.",
    "Passing this check does not authorize implementation or deployment.",
)


@dataclass(frozen=True)
class CheckResult:
    status: str
    errors: tuple[str, ...]
    metrics: dict[str, Any]
    artifact_hash: str
    scope: str = "design_artifact_only"
    limits: tuple[str, ...] = LIMITS

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def resource_text(name: str) -> str:
    return files("fde_workbench").joinpath("resources", name).read_text(encoding="utf-8")


def language(lang: str) -> str:
    if lang not in LABELS:
        raise ValueError("language must be en or ko")
    return lang


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(",", ":")
    )
    return hashlib.sha256(encoded.encode()).hexdigest()


def new_design(identifier: str, problem: str = "") -> dict[str, Any]:
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", identifier):
        raise ValueError("id must contain 2–64 lowercase letters, digits or hyphens")
    return {
        "version": "1",
        "id": identifier,
        "stage": "draft",
        "brief": dict.fromkeys(BRIEF_FIELDS, ""),
        "critiques": [],
        "decisionOwner": "",
        "problem": problem,
        "currentWorkflow": "",
        "decisionToSupport": "",
        "nonGoals": [],
        "sources": [],
        "requirements": [],
        "alternatives": [],
        "assumptions": [],
        "scenarios": [],
        "claims": [],
        "deployment": dict.fromkeys(
            (
                "runtime",
                "identityBoundary",
                "dataBoundary",
                "capacityModel",
                "failureRecovery",
                "releaseRollback",
                "observability",
                "operatingOwner",
            ),
            "",
        ),
        "nextValidation": "",
        "executionAllowed": False,
    }


def check_design(pack: Any) -> CheckResult:
    digest = canonical_hash(pack)
    validator = Draft7Validator(json.loads(resource_text("design.schema.json")))
    errors = [
        f"/{'/'.join(map(str, e.absolute_path))}: {e.message}"
        for e in sorted(validator.iter_errors(pack), key=lambda e: str(list(e.absolute_path)))
    ]
    if errors:
        return CheckResult("fail", tuple(errors), {}, digest)
    seen: set[str] = set()
    for group in ("sources", "requirements", "alternatives", "assumptions", "scenarios", "claims"):
        for item in pack[group]:
            if item["id"] in seen:
                errors.append("duplicate_id:" + item["id"])
            seen.add(item["id"])
    sources = {s["id"]: s for s in pack["sources"]}
    scenarios = {s["id"] for s in pack["scenarios"]}
    alternatives = {a["id"] for a in pack["alternatives"]}

    def refs(items: list[str], known: Any, label: str) -> None:
        errors.extend(f"unknown_{label}:{ref}" for ref in items if ref not in known)

    for requirement in pack["requirements"]:
        refs(requirement["sourceIds"], sources, "source")
        refs(requirement["scenarioIds"], scenarios, "scenario")
    for alternative in pack["alternatives"]:
        refs(alternative["evidenceIds"], sources, "source")
    for scenario in pack["scenarios"]:
        refs(scenario["alternativeIds"], alternatives, "alternative")
    for claim in pack["claims"]:
        refs(claim["sourceIds"], sources, "source")
        if claim["kind"] == "empirical_outcome" and not any(
            sources.get(ref, {}).get("kind") in ("human_observation", "lab_measurement")
            for ref in claim["sourceIds"]
        ):
            errors.append("unsupported_empirical_claim:" + claim["id"])
    for source in pack["sources"]:
        try:
            date.fromisoformat(source["checkedAt"])
        except ValueError:
            errors.append("invalid_source_date:" + source["id"])
        try:
            parsed = urlsplit(source["url"])
            _ = parsed.port
        except ValueError:
            errors.append("invalid_source_url:" + source["id"])
            continue
        if source["kind"] != "synthetic" and (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or any(character.isspace() for character in source["url"])
            or "\\" in source["url"]
        ):
            errors.append("invalid_source_url:" + source["id"])
    selected = [a["id"] for a in pack["alternatives"] if a["disposition"] == "selected"]
    if not selected:
        errors.append("no_selected_approach")
    if len({a["mechanism"].strip() for a in pack["alternatives"]}) != len(pack["alternatives"]):
        errors.append("duplicate_alternative_mechanism")
    characters = sum(len(pack["brief"][key]) for key in BRIEF_FIELDS)
    if characters > 900:
        errors.append("brief_too_long")
    if len({c["lens"].strip().casefold() for c in pack["critiques"]}) < 3:
        errors.append("insufficient_critique_lenses")
    if pack["stage"] != "review_ready":
        errors.append("draft_not_review_ready")
    metrics = {
        "briefCharacters": characters,
        "critiqueLenses": len(pack["critiques"]),
        "requirements": len(pack["requirements"]),
        "linkedRequirements": sum(
            all(ref in scenarios for ref in r["scenarioIds"]) for r in pack["requirements"]
        ),
        "alternatives": len(pack["alternatives"]),
        "selected": selected,
        "scenarios": len(pack["scenarios"]),
        "unresolvedAssumptions": len(pack["assumptions"]),
    }
    return CheckResult("fail" if errors else "pass", tuple(errors), metrics, digest)


def render_brief(pack: dict[str, Any], lang: str = "en") -> str:
    language(lang)
    brief = pack.get("brief")
    if not isinstance(brief, dict):
        raise ValueError("brief_missing")
    for key in BRIEF_FIELDS:
        if not isinstance(brief.get(key), str) or len(brief[key].strip()) < 8:
            raise ValueError("brief_missing_" + key)
    count = sum(len(brief[key]) for key in BRIEF_FIELDS)
    if count > 900:
        raise ValueError("brief_too_long")
    title = "Decision brief" if lang == "en" else "빠른 검토 초안"
    note = (
        "Draft for review. Assumptions remain open; no execution is authorized."
        if lang == "en"
        else "검토용 초안입니다. 미확인 가정이 남아 있으며 실행 승인을 의미하지 않습니다."
    )
    body = "\n\n".join(
        f"**{label}** {brief[key]}" for label, key in zip(LABELS[lang], BRIEF_FIELDS, strict=True)
    )
    # Do not claim that labels translate user-authored content.
    footer = (
        f"{count} characters · source content is preserved."
        if lang == "en"
        else f"본문 {count}자 · 작성한 원문을 보존합니다."
    )
    return f"# {title} · {pack.get('id', 'untitled')}\n\n{note}\n\n{body}\n\n---\n{footer}\n"
