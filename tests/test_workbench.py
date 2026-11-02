from __future__ import annotations

import hashlib
import json
import zipfile
from copy import deepcopy
from pathlib import Path

import pytest

from fde_workbench import (
    check_design,
    export_report,
    install_skill,
    make_bundle,
    new_design,
    render_brief,
)
from fde_workbench.cli import load_design, main
from fde_workbench.core import resource_text
from fde_workbench.delivery import build_skill


@pytest.fixture
def pack():
    return json.loads(resource_text("examples/support-triage.en.json"))


@pytest.mark.parametrize("lang", ["en", "ko"])
def test_localized_examples_are_valid(lang):
    pack = json.loads(resource_text(f"examples/support-triage.{lang}.json"))
    result = check_design(pack)
    assert result.status == "pass"
    assert result.scope == "design_artifact_only"
    assert result.metrics["selected"] == ["rules-lookup"]
    assert pack["executionAllowed"] is False


def test_draft_never_claims_readiness():
    draft = new_design("new-problem", "An operational problem")
    assert check_design(draft).status == "fail"
    assert draft["problem"] == "An operational problem"


@pytest.mark.parametrize("identifier", ["../escape", "x", "Capitalized", "", "a" * 65])
def test_identifiers_cannot_be_paths(identifier):
    with pytest.raises(ValueError):
        new_design(identifier)


@pytest.mark.parametrize(
    "group,key,ref",
    [
        ("requirements", "sourceIds", "unknown_source"),
        ("requirements", "scenarioIds", "unknown_scenario"),
        ("alternatives", "evidenceIds", "unknown_source"),
        ("scenarios", "alternativeIds", "unknown_alternative"),
    ],
)
def test_rejects_broken_traceability(pack, group, key, ref):
    pack[group][0][key] = ["invented"]
    assert f"{ref}:invented" in check_design(pack).errors


def test_vendor_and_synthetic_claims_are_not_empirical_outcomes(pack):
    pack["claims"][0]["kind"] = "empirical_outcome"
    assert "unsupported_empirical_claim:value-claim" in check_design(pack).errors


def test_rejects_duplicate_ids_across_groups(pack):
    pack["scenarios"][0]["id"] = pack["sources"][0]["id"]
    assert "duplicate_id:sample-data" in check_design(pack).errors


def test_rejects_fake_alternative_diversity(pack):
    pack["alternatives"][1]["mechanism"] = pack["alternatives"][0]["mechanism"]
    assert "duplicate_alternative_mechanism" in check_design(pack).errors


def test_requires_an_explicit_selection(pack):
    for alternative in pack["alternatives"]:
        alternative["disposition"] = "rejected"
    assert "no_selected_approach" in check_design(pack).errors


def test_rejects_normalized_invalid_calendar_dates(pack):
    pack["sources"][0]["checkedAt"] = "2026-02-30"
    assert "invalid_source_date:sample-data" in check_design(pack).errors


@pytest.mark.parametrize(
    "url",
    [
        "https:///missing-host",
        "https://user:password@example.com",
        "javascript:alert(1)",
        "https://[",
        "https://example.com:bad",
        "https:// bad.com",
    ],
)
def test_public_evidence_links_require_real_https_without_credentials(pack, url):
    pack["sources"][0]["kind"] = "public_dataset"
    pack["sources"][0]["url"] = url
    assert "invalid_source_url:sample-data" in check_design(pack).errors


def test_rejects_extra_fields_and_execution_permission(pack):
    pack["invented"] = True
    assert check_design(pack).status == "fail"
    del pack["invented"]
    pack["executionAllowed"] = True
    assert check_design(pack).status == "fail"


def test_critique_lenses_must_be_distinct(pack):
    for critique in pack["critiques"]:
        critique["lens"] = " SAME VIEW "
    assert "insufficient_critique_lenses" in check_design(pack).errors


def test_brief_works_before_full_dossier_is_complete(pack):
    minimal = {"id": pack["id"], "brief": pack["brief"]}
    assert "Weakness & counterargument" in render_brief(minimal)
    assert check_design(minimal).status == "fail"


def test_locale_changes_labels_not_user_authored_facts(pack):
    en = render_brief(pack, "en")
    ko = render_brief(pack, "ko")
    assert "**Background**" in en
    assert "**배경**" in ko
    assert pack["brief"]["background"] in ko
    assert "source content is preserved" in en


def test_brief_rejects_missing_counterargument_and_excess_length(pack):
    broken = deepcopy(pack)
    del broken["brief"]["weaknessCounterargument"]
    with pytest.raises(ValueError, match="brief_missing_weaknessCounterargument"):
        render_brief(broken)
    pack["brief"]["background"] = "x" * 901
    with pytest.raises(ValueError, match="brief_too_long"):
        render_brief(pack)


def test_canonical_hash_does_not_depend_on_key_order(pack):
    reordered = json.loads(json.dumps(pack, sort_keys=True))
    assert check_design(pack).artifact_hash == check_design(reordered).artifact_hash


def test_report_is_offline_escaped_and_preserves_contract_order(pack, tmp_path):
    pack["problem"] = '<script>alert("bad")</script>'
    pack["brief"]["background"] = "<script>bad()</script> is untrusted source text."
    sorted_pack = json.loads(json.dumps(pack, sort_keys=True))
    target = export_report(sorted_pack, tmp_path / "review")
    report = (target / "REPORT.html").read_text()
    assert "<script>" not in report
    assert "&lt;script&gt;" in report
    assert "default-src 'none'" in report
    assert "<script src" not in report
    assert report.index("Background</h3>") < report.index("Pain point</h3>")
    manifest = json.loads((target / "manifest.json").read_text())
    assert manifest["humanReview"] == "not_run"
    for name, digest in manifest["files"].items():
        assert hashlib.sha256((target / name).read_bytes()).hexdigest() == digest


def test_synthetic_urls_cannot_become_executable_report_links(pack, tmp_path):
    pack["sources"][0]["url"] = "javascript:alert(1)"
    report = export_report(pack, tmp_path / "review") / "REPORT.html"
    assert 'href="javascript:' not in report.read_text()


def test_export_refuses_to_publish_invalid_design(tmp_path):
    with pytest.raises(ValueError, match="incomplete or invalid"):
        export_report(new_design("incomplete"), tmp_path / "review")
    assert not (tmp_path / "review").exists()


def test_output_refuses_to_clobber_existing_directory_or_symlink(pack, tmp_path):
    target = tmp_path / "existing"
    target.mkdir()
    (target / "precious.txt").write_text("keep")
    with pytest.raises(FileExistsError):
        export_report(pack, target)
    assert (target / "precious.txt").read_text() == "keep"
    link = tmp_path / "link"
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        pytest.skip("host does not allow symlink creation")
    with pytest.raises(FileExistsError):
        export_report(pack, link)


def test_bundles_are_repeatable_and_contain_verified_outputs(pack, tmp_path):
    a = make_bundle(pack, tmp_path / "a.zip")
    b = make_bundle(pack, tmp_path / "b.zip")
    assert a.read_bytes() == b.read_bytes()
    with zipfile.ZipFile(a) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        assert set(archive.namelist()) == {
            "design.json",
            "BRIEF.md",
            "REPORT.html",
            "CHECKS.json",
            "manifest.json",
        }
        for name, digest in manifest["files"].items():
            assert hashlib.sha256(archive.read(name)).hexdigest() == digest
    with pytest.raises(FileExistsError):
        make_bundle(pack, a)


def test_skill_is_portable_versioned_and_requires_explicit_directory(tmp_path):
    target = install_skill(tmp_path / "skills")
    assert target.name == "fde-workbench"
    assert (target / "SKILL.md").exists()
    assert (target / "references/design.schema.json").exists()
    assert (target / "references/reviews.md").exists()
    manifest = json.loads((target / "manifest.json").read_text())
    for name, digest in manifest["files"].items():
        assert hashlib.sha256((target / name).read_bytes()).hexdigest() == digest
    with pytest.raises(FileExistsError):
        install_skill(tmp_path / "skills")
    archive = build_skill(tmp_path / "skill.zip")
    with zipfile.ZipFile(archive) as skill:
        assert "fde-workbench/SKILL.md" in skill.namelist()


def test_cli_workflow_and_failure_exit_codes(tmp_path, capsys):
    draft = tmp_path / "draft-work"
    assert main(["init", str(draft)]) == 0
    assert main(["check", str(draft), "--json"]) == 1
    sample = tmp_path / "example"
    assert main(["example", "support-triage", "--output", str(sample)]) == 0
    assert main(["check", str(sample)]) == 0
    assert main(["brief", str(sample), "--lang", "en"]) == 0
    assert main(["export", str(sample), "--output", str(tmp_path / "report")]) == 0
    assert main(["example", "support-triage", "--output", str(sample)]) == 2
    assert "already exists" in capsys.readouterr().err


def test_evaluation_keeps_failed_inputs_in_denominator(tmp_path, capsys):
    sample = tmp_path / "sample"
    main(["example", "support-triage", "--output", str(sample)])
    capsys.readouterr()
    assert main(["evaluate", str(sample), str(tmp_path / "missing.json")]) == 1
    result = json.loads(capsys.readouterr().out)
    assert result["passed"] == 1
    assert result["total"] == 2


@pytest.mark.parametrize("payload", ['{"id":"a","id":"b"}', '{"number":NaN}', "[]"])
def test_json_loader_rejects_ambiguous_or_non_finite_input(payload, tmp_path):
    target = tmp_path / "bad.json"
    target.write_text(payload)
    with pytest.raises(ValueError):
        load_design(target)


def test_json_loader_bounds_input_size(tmp_path):
    target = tmp_path / "large.json"
    target.write_bytes(b" " * 2_000_001)
    with pytest.raises(ValueError, match="2 MB"):
        load_design(target)


def test_python_and_javascript_contract_copies_match():
    source = Path("packages/contracts/design.schema.json")
    if not source.exists():
        pytest.skip("source-checkout parity check; installed distribution is self-contained")
    assert json.loads(resource_text("design.schema.json")) == json.loads(source.read_text())
    assert json.loads(resource_text("skill/references/design.schema.json")) == json.loads(
        source.read_text()
    )


def test_skill_frontmatter_and_references_are_self_contained():
    import yaml

    text = resource_text("skill/SKILL.md")
    header = text.split("---", 2)[1]
    metadata = yaml.safe_load(header)
    assert metadata["name"] == "fde-workbench"
    assert "operational problem" in metadata["description"]
    assert resource_text("skill/references/methods.md")
    reviews = resource_text("skill/references/reviews.md")
    assert "references/reviews.md" in text
    for lens in (
        "Feature teardown",
        "Compatibility and deployment scalability",
        "Validation method",
        "Target environment fit",
    ):
        assert f"## {lens}" in reviews
    assert (
        json.loads(resource_text("skill/references/design.schema.json"))["$id"] == "fde.design.v1"
    )


def test_repository_skill_copy_matches_packaged_skill():
    from fde_workbench.delivery import skill_files

    source = Path(".agents/skills/fde-workbench")
    if not source.exists():
        pytest.skip("source-checkout parity check; installed distribution is self-contained")
    packaged = skill_files()
    on_disk = {
        str(path.relative_to(source)).replace("\\", "/"): path.read_bytes()
        for path in source.rglob("*")
        if path.is_file()
    }
    assert set(on_disk) == set(packaged)
    for name, data in packaged.items():
        if name == "manifest.json":
            assert json.loads(on_disk[name]) == json.loads(data)
        else:
            assert on_disk[name] == data, name
