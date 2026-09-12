# Adjacency traversal measurement

Measured 2026-09-07 on Node 25.9.0 in the remediation worktree. This is a local microbenchmark, not a production latency guarantee.

Compared `packages/core/src/graph/adjacency.ts` from commit `2d198e846f8fc520b5f25a5e1af27ffda79e7365` with the current implementation. Both used identical current dependencies, preallocated snapshots, event objects and serializer functions. The old source was read with `git show`, transformed in memory using the repository Babel config, and loaded with Node's `Module._compile`; the new source loaded through the existing Preconstruct source hook. No built release artifacts or network inputs were involved.

Each implementation ran four times per case. Discarded the first run as warmup; reported median of the remaining three. Time includes adjacency construction and counting returned states. Compared the full adjacency change (cursor/compaction, removal of unused state map, null-prototype dictionaries), rather than claiming to isolate one instruction.

| Case | Workload | Before median | After median | Returned states |
| --- | --- | ---: | ---: | ---: |
| Small | Initial state has 20 distinct outgoing edges; destinations have none | 0.04 ms | 0.03 ms | 21 |
| Wide | Initial state has 20,000 distinct outgoing edges; destinations have none | 35.59 ms | 4.93 ms | 20,001 |
| Dense | Initial state plus 200 destinations; each has edges to all 200 destinations | 160.53 ms | 2.00 ms | 201 |

Snapshots were `{ status: 'active', id }`; events `{ type: 'TO', id }`. Transition returned the preallocated destination snapshot. Serializers returned `String(id)` for both states and events. Traversal limits remained infinite. Source tests separately verify predecessor-sensitive serialization, event ordering, path reconstruction and arbitrary serializer keys.

Other verification: core suite 2,506 passed, 33 skipped, 3 todo; SCXML suite 316 passed plus one existing protocol-deviation skip; new isolation tests also passed. Typecheck, repository lint and scoped formatting passed. Source-hook smoke exposed and fixed an unsupported Babel `declare` class field; affected store suite subsequently passed 55 tests.
