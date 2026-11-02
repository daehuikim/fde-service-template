---
name: fde-problem-design
description: Guides field problem discovery, evidence review, comparison of different methods and design handoff. Use when a user brings an industrial or operational problem, asks what to build, or requests analysis and design before implementation.
---

# Field problem → appropriate design

## Trigger / input
A real workflow, desired decision, current alternative, available public/authorized evidence and requested work scope. Do not assume the example app is the target architecture.

## Fast first draft

Before waiting for a complete design pack, give a concise draft from the available context: background, pain point, value hypothesis, technical combination and reason, scaling trigger, strongest weakness/counterargument, next check. Mark unknowns and hypotheses. Aim for <=900 Korean characters of body text; do not claim a measured one-minute reading time. Link detail rather than burying the decision in a report. Use docs/technology-glossary.md for ontology, harness, LLM provider, RAG and related distinctions; include only terms relevant to the task.

## Procedure
1. Read root AGENTS.md, config/policy.json and docs/design-playbook.md. If the user asks for design only, stop before product implementation.
2. Establish whose decision changes, current workflow/baseline, failure consequence, constraints and definition of success. Ask only consequential missing questions; keep researching public evidence while answers are pending.
3. Profile the available data: provenance, rights, identifiers/units, observation/effective dates, missingness, representativeness. Separate official/vendor reports, observed facts, hypotheses and synthetic examples. Never infer missing business inputs from a convenient dataset.
4. Compare genuinely different relevant methods, including the current/manual/no-new-software option. Consider SQL/rules/search/optimization/statistics/LLM/semantic models only where the task needs them; this is a menu, not a mandatory architecture list. State mechanisms, data/operating needs, fit/failure conditions and rejection reasons. Do not assign invented numeric weights to disguise judgment.
5. Choose the smallest approach that supports the current decision. State what evidence or scale/ownership change would make the choice different. A shortlist of investigations or a data acquisition plan can be the right output when investment/action inputs are missing. Do not always favor or reject ontology or LLMs.
6. Use tiny mocks or calculation sheets only to challenge the design. Review overlap, infeasible constraints, unknown/stale evidence, conflicting sources, authorization, partial failures and changed inputs. Do not claim product/model accuracy from design scenarios.
7. Critique from relevant business/user, data/domain, security, cost and architecture/operations perspectives. State residual risks and what would reverse the choice; label simulated perspectives as self review. Create/update designs/<id>/design.json (`pnpm design:start <id>`). Specify task states, input/output contracts, failure/abstention/handoff, versioning, identity/data/deployment/operating boundaries and the next falsifiable evaluation.
8. Render `pnpm brief designs/<id>/design.json` as soon as its brief is ready, even if the full pack is incomplete. Run `pnpm design:check designs/<id>/design.json`. Treat pass as artifact traceability only. Independently reason about source entailment, suitability, tradeoffs and counterexamples. Record self review, independent expert review and user observation separately.

## Output
Problem and evidence brief; relevant alternative comparison; selected/rejected/conditional methods with reasons; assumptions and decision-changing conditions; design and implementation handoff; quantitative traceability/calculation checks; qualitative critique; unresolved questions and next field validation.

## Completion
Sources and limitations are explicit. Requirements link to review scenarios. Method choices follow the problem rather than a named vendor. Unsupported decisions are deferred. The requested design scope is respected. No automatic source-ID check or self review is described as independent field validation. Product execution remains unauthorized by this artifact.
