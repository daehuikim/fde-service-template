# FDE Workbench guide

[English](guide.md) · [한국어](../ko/guide.md) · [Home](../../README.md)

## Start with the decision

Identify whose decision changes, the current workflow, pain and success condition. Compare the current/manual option with relevant alternatives. A spreadsheet can be the right answer. Missing data can justify an acquisition plan instead of a premature model, investment or application.

```sh
fde init work/my-problem --problem "Which maintenance requests should be investigated first?"
```

This writes `design.json` and a short workspace README. It intentionally fails `fde check` until completed. Fill the `brief` first; `fde brief work/my-problem` can render it before the full dossier is ready. A complete synthetic example is available through `fde example support-triage --output demo`.

## Build a reviewable design

The bundled JSON Schema defines the contract; print it with `fde schema`. Record sources, requirements, distinct alternatives, assumptions, failure/change scenarios, claim categories, critiques and operating boundaries. Connect IDs rather than burying evidence in prose. Mark unsupported business outcomes as hypotheses. Do not confuse an official vendor case with independently measured results.

`fde check` validates structure, references, calendar dates, HTTPS source addresses, selection/rejection records and distinct critique lenses. Its pass does not prove that a source supports a sentence, that the method is best, or that users benefit. Synthetic examples remain synthetic. The package does not call models or fetch URLs.

## Export and hand off

```sh
fde check work/my-problem
fde export work/my-problem --output review --lang en
fde bundle work/my-problem --output handoff.zip --lang en
```

Export requires a structurally valid, review-ready design and creates a new destination. Existing directories/files are not overwritten. `REPORT.html` contains no scripts or remote assets. The bundle includes `design.json`, `BRIEF.md`, `REPORT.html`, `CHECKS.json` and `manifest.json`; the manifest hashes the other files. ZIP entry order, timestamps and permissions are fixed for repeatable output with the same runtime and inputs.

## Install the skill

```sh
fde skill install --directory .agents/skills
```

The destination is explicit. The installed folder includes instructions, the design schema, method-selection reference, MIT notice and a file-hash manifest. Use a skills directory supported by your host; this command does not change host settings or enable model/tool access. To share the skill itself:

```sh
fde skill build --output fde-workbench-skill.zip
```

The skill is useful without the CLI, but automated checks must then be reported as not run. For reliable validation, install the matching Python package version.

## Languages

`--lang en|ko` selects labels in briefs/reports and the language of the bundled example. It does not machine-translate user-authored data. Draft in the reader's language. Both README entrypoints link to one another.

## Optional service example

The repository retains a Next.js/CSV/PostgreSQL example for later implementation work. It is not shipped in the Python wheel and does not prescribe the architecture for a new problem. [Web example](web-example.md)
