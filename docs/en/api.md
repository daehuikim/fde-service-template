# CLI & Python API

[English](api.md) · [한국어](../ko/api.md) · [Guide](guide.md)

| Command | Result |
|---|---|
| `fde init PATH [--id ID] [--problem TEXT] [--lang en\|ko]` | New incomplete workspace; refuses existing destination |
| `fde example support-triage --output PATH --lang en\|ko` | Localized, fully synthetic example |
| `fde check PATH [--json]` | Schema and traceability result; accepts a directory or design.json |
| `fde brief PATH --lang en\|ko [--output FILE]` | Short Markdown brief; full design may still be incomplete |
| `fde export PATH --output DIR --lang en\|ko` | Offline report and content manifest |
| `fde bundle PATH --output FILE.zip --lang en\|ko` | Repeatable handoff archive |
| `fde evaluate PATH...` | All results, including invalid/missing inputs in the denominator |
| `fde skill install --directory DIR` | Versioned skill under DIR/fde-workbench |
| `fde skill build --output FILE.zip` | Portable skill distribution |
| `fde schema [--output FILE]` | Bundled JSON Schema |
| `fde doctor` | Runtime, dependency and resource metadata; no secret values |

Exit codes: **0** success, **1** invalid design/evaluation, **2** usage, malformed input or I/O failure. File inputs are limited to 2 MB; duplicate JSON keys and non-finite values are rejected. Outputs never replace existing paths.

```python
from pathlib import Path
from fde_workbench import (
    new_design, check_design, render_brief,
    export_report, make_bundle, install_skill,
)

pack = new_design("request-routing", problem="Choose the right owner for each request.")
result = check_design(pack)  # incomplete drafts fail
print(result.status, result.errors)
print(result.to_dict())
# Fill the brief, evidence, alternatives and review fields before export.
```

`check_design(pack)` returns an immutable `CheckResult` wrapper with status, errors, metrics, canonical artifact hash, scope and limits. The hash identifies canonical content, not authenticity. `render_brief(pack, lang)` returns Markdown. Export/bundle functions validate the full design and return the created `Path`. `install_skill(directory)` writes only the chosen destination. `py.typed` is included for typed consumers.

Schema and label checks are deterministic. No source URL is fetched, no provider is called, and no data is uploaded by the Python core. Host-assistant behavior follows the host's permissions.
