# FDE Workbench

An offline Python CLI and library for evidence-led problem design: concise briefs, alternative comparisons, critical reviews, portable reports, and agent skills.

Python 3.10+. MIT licensed. Install from the versioned [GitHub release](https://github.com/daehuikim/fde-service-template/releases), or from the source checkout with `pip install .`.

```console
fde example support-triage --output demo --lang en
fde check demo
fde brief demo --lang en
fde export demo --output review --lang en
fde bundle demo --output handoff.zip
fde skill install --directory .agents/skills
```

The package performs schema and traceability checks. It does not verify source truth, select the best method automatically, or make model calls. Your coding assistant uses the skill to research and draft; the CLI checks and packages that work. English and Korean labels/examples are included. Language selection does not translate user-authored text.

[English guide](https://github.com/daehuikim/fde-service-template/blob/main/docs/en/guide.md) · [한국어](https://github.com/daehuikim/fde-service-template/blob/main/README.ko.md) · [Source](https://github.com/daehuikim/fde-service-template)
