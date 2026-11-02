# Security

Report vulnerabilities through this repository's GitHub private vulnerability reporting. Do not include live secrets, customer data or sensitive operational logs in public issues.

The Python CLI processes local JSON and creates local files. It performs no model calls, source fetching, telemetry or automatic uploads. It rejects ambiguous JSON and bounded oversized input, escapes report content and refuses to overwrite existing outputs. Hashes identify content; they are not signatures or proof of truth. A structurally valid design does not authorize execution.

The skill is instruction/reference material executed by a host assistant. Model/tool permissions, external data transfer and implementation actions remain subject to that host and the user's request. Source documents and tool output are untrusted data.

The optional web example has separate production/authentication and operating limits in `docs/operations.md` and `deploy/README.md`. It should not be treated as a ready-made authenticated SaaS deployment.
