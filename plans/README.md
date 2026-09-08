# Codebase audit remediation

Completed on `feature/codebase-audit-remediation`, based on fetched `origin/next` at `2c4eeb4881`. The shared checkout and its unrelated documentation edits remain unchanged.

| Plan | Findings | Status |
| --- | --- | --- |
| 001 async atom | 5 | DONE, 949a6a10b9 |
| 002 persistence purity/order | 7, 8 | DONE, f5f95210ae |
| 003 actor teardown/React observers | 1, 14 | DONE, 1467582a6c |
| 004 store composition | 6, 9–13, store queue | DONE, 305c939ed9 |
| 005 core restoration/graph | 2–4, 21–24, graph queue | DONE, 6e8d66f8e0 |
| 006 adapters/codemod | 15–20, comparator, duplicate subscriptions | DONE, 2f1f62fbd2, 2d198e846f |
| 007 templates/tooling/dependencies | templates, checks, dependency debt | DONE |
| 008 bundle capability | measured runtime retention and size reporting | DONE; lazy-binding experiment rejected after measurement |
| 009 example completion | all 49 projects and newly exposed workflow bugs | DONE |

[Full review and audit-to-fix mapping](remediation-review.md). [Graph benchmark](005-graph-benchmark.md). [Bundle measurements](008-bundle-measurements.md).

Verification: source and built suites each pass 3,138 tests (35 skipped, three todo); typecheck, lint, formatting, Knip, Svelte Check, frozen install and production build pass. All seven public core code entrypoints pass strict declaration checking. All 25 source and 25 public-package bundle profiles pass behavior assertions with both minifiers.

The exact example gate passes all 49 projects and build scripts, 91 Vitest regressions, six Node tooling tests and a persistence CLI restart. The checker recursively checks TypeScript project references; its own regression catches previously invisible errors behind empty solution configs. Four standalone templates pass frozen installs/builds; representative browser and CLI flows were verified separately.

Dependency audit: 136 advisories reduced to seven, and dependencies reduced from 2,293 to 1,482. All remaining reports concern Angular 19.2.25 development dependencies; the specified 19.2.26 patch is unavailable from the registry. No public framework peer major was widened. See the review for evidence boundaries and workload-specific performance results.
