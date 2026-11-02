# Method selection vocabulary

[English](concepts.md) · [한국어](../technology-glossary.md)

| Term | Role | When to consider it | Limitation |
|---|---|---|---|
| Ontology | Shared meaning for concepts, relationships and constraints | Repeated cross-team semantic reuse | Governance and maintenance can exceed the value of a small workflow |
| Harness | State, context, tool permissions, budgets, recovery and evaluations surrounding execution | Long-running or tool-using tasks | A prompt/framework name does not supply these controls |
| LLM provider | Managed or self-hosted inference endpoint | A task needs language-model capabilities | Compare task quality, data location, latency and total operating cost |
| RAG | Retrieve source material, then condition generation on it | Grounded synthesis over a changing corpus | Retrieval, citations, freshness and authorization can still fail |
| Rules / SQL | Explicit conditions, joins, constraints and calculations | Structured inputs and known policies | Ambiguous interpretation needs a separate treatment |
| Optimization | Choose a combination under an agreed objective and constraints | Allocation, scheduling or portfolio decisions | A mathematical optimum does not correct the wrong objective or inputs |
| Forecasting | Estimate future/unobserved values | Representative historical data and a valid holdout exist | Leakage and selection bias can produce misleading confidence |
| Workflow / agent | Predetermined control flow / model-directed next steps | Match autonomy to path uncertainty | More autonomy adds cost, latency and failure paths |

These are options to compare, not a mandatory stack. Expansion arguments should identify a measured bottleneck, a trigger to change methods, the new owner and the additional failure path.

Primary references: [W3C ontology primer](https://www.w3.org/TR/owl2-primer/), [harness engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [RAG paper](https://arxiv.org/abs/2005.11401), [workflow and agent distinction](https://www.anthropic.com/engineering/building-effective-agents). Retrieved 2026-11-02. The descriptions above are project guidance, not claims that the Python package implements every technology.
