---
name: stack-diagram
description: Generates offline architecture figures from a versioned spec. Use when changing repository or deployment architecture.
---

# Local stack-diagram integration

Upstream: caru-ini/stack-diagram at 9e90a3b286baa6eef9700ca01abb80dbf0ad1514, MIT.
This is a local, text-oriented layer/deployment adaptation, not the upstream full logo workflow.

1. Edit docs/architecture/architecture.spec.json and ADR. Define paths, trust boundaries, protocol, synchrony, external transfer and implementation status.
2. Run `pnpm diagram`. The local layout generator uses the upstream asset-inlining build.py and font assets.
3. Run `pnpm diagram:check` to check spec, source paths, source/output hashes and stale output.
4. Review SVG/HTML when an allowed viewer is available. Record visual review separately from structure checks.

Only build.py, geometry/reference documents, template/generic assets and licensed fonts are installed. Gallery/share.py, upstream network fetcher and render_png.py are intentionally excluded. Do not install or run a browser to bypass restricted-assignment. No logo trademark assets are used. Korean labels use embedded Pretendard v1.3.9/OFL.
