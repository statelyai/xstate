# Audit remediation review

Branch: `feature/codebase-audit-remediation`, isolated from fetched `origin/next` at `2c4eeb4881`. Shared checkout and its unrelated documentation edits preserved.

## Correctness findings

| Audit finding | Resolution | Commit |
| --- | --- | --- |
| 1 Parent error leaves children running | Stop owned children from current/prior snapshots and registry; preserve custom stop hooks | 1467582a6c |
| 2 Restored callbacks lose attachments | Reattach active process-local keyed effects on restoration | 6e8d66f8e0 |
| 3 Interrupted local steps never finish | Retry abandoned active records; retain completed outcomes; deduplicate live steps and reject waiters on termination | 6e8d66f8e0 |
| 4 SCXML scratch crosses actors or misses errors | Actor-local evaluation state, microstep error draining, probe isolation | 6e8d66f8e0 |
| 5 Async atoms lose dependencies | Settlement updates values without recollecting away dependency links | 949a6a10b9 |
| 6 Writable updater reads become dependencies | Run writable updater reads untracked | 305c939ed9 |
| 7 Hypothetical transitions write persistence | Buffer/schedule only committed effects | f5f95210ae |
| 8 Async writes complete out of order | Serialize storage operations; flush awaits pending writes | f5f95210ae |
| 9 Undo discards extension metadata | Preserve live extension fields and full triggered restore snapshots | 305c939ed9 |
| 10 Initial async storage rejection unhandled | Attach configured error handling | 305c939ed9 |
| 11 Throttled pick runs twice | Buffer full context; select once at write | 305c939ed9 |
| 12 Cleared storage reappears | Cancel buffered writes and order removal after in-flight writes | 305c939ed9 |
| 13 Throwing atom listener corrupts notification queue | Drain remaining listeners, restore queue invariants, rethrow first error | 305c939ed9 |
| 14 React observer keeps old actor | Rebind before replacement actor starts | 1467582a6c |
| 15 Svelte resubscription reads stale snapshot | Refresh on subscription | 2f1f62fbd2 |
| 16 Solid merges incompatible containers | Replace array/object shape using shared clone references | 2f1f62fbd2 |
| 17 Solid setup misses updates | Subscribe then reconcile current snapshot | 2f1f62fbd2 |
| 18 Vue/Solid miss terminal error snapshots | Reconcile snapshot in error callbacks | 2f1f62fbd2 |
| 19 Codemod produces invalid payload schemas | Normalize member separators, preserve escaped discriminants, refuse syntactically invalid output | 2d198e846f |
| 20 Codemod imports collide or disappear | Resolve actual value binding; handle aliases, namespaces, type-only imports and shadowing | 2d198e846f |
| 21 Known graph path explores unbounded graph | Transition directly through requested event sequence | 6e8d66f8e0 |
| 22 Path generation initializes logic twice | Reuse resolved initial snapshot | 6e8d66f8e0 |
| 23 Serialized keys collide with prototypes | Null-prototype dictionaries and explicit absent-key checks | 6e8d66f8e0 |
| 24 Throwing simulated timer corrupts clock | Exception-safe flushing with recoverable invalidation | 6e8d66f8e0 |

Additional fixes include React store custom comparators, redundant Vue subscriptions, reentrant persistence flushing, and breadth-first queue cursors.

Interrupted local steps have **at-least-once** execution. Documentation now explains idempotency and distinguishes host-controlled durability; persisted snapshots do not guarantee exactly-once external side effects.

## Performance evidence

Store fanout, five warmups/nine alternating median samples on Node 25.9: 16-event bursts 0.001897→0.001747 ms; 50,000-event bursts 1096.577→6.081 ms. Final event counts and breadth-first effect order checked. The large case is a throughput stress test, not average UI latency.

Graph traversal: small 20-node frontier 0.04→0.03 ms; wide 20,000-node frontier 35.59→4.93 ms; dense 200-node graph 160.53→2.00 ms. See [methodology](005-graph-benchmark.md).

## Starters

Commit `d27b2172ed` aligns React, Vue, Svelte and vanilla templates to pinned published v6 alpha packages. Supported Vite 8 tooling, Svelte 5 mount API, standalone frozen lockfiles and documented Node requirements. Removed incompatible optional v5 inspector integrations. Browser checks cover empty-submit gating, draft retention, submission and reset; vanilla checks use the public actor interface. Four clean installs/builds passed; four dependency audits returned zero advisories. Evidence: `/tmp/xstate-template-audit.1FrdxE/evidence.md`.

## Follow-up review

Additional core regressions cover arbitrary effect/state names, draining every cleanup after one throws, explicit undefined traversal options, and SCXML guard-probe error isolation. A strict public-package consumer caught broken references in generated declarations; source annotations repair the boundary. The consumer checks every public core code export with `skipLibCheck: false`.

The repaired example checker exposed 42 failures across 49 projects. Final integration also exposed a solution-config false pass; recursive project-reference checking now has a bad-to-good JSONC fixture regression. Stale example aliases into library source were removed so compilers consume the public package declarations. Remediation covers all projects: coherent v6 machines, importable workflow definitions separated from executable demos, maintained build runners, and real transition/completion/error tests. Representative browser checks cover flight booking, temperature conversion, Todo persistence/editing, local-image tiles and trivia retry/scoring. MongoDB boundaries use in-process mocks; no live database, email or media library was modified.

Workflow review additionally repaired empty-auction completion, lost lender data, book-checkout completion, nested appointment output, high-priority filtering, and stalled reading timers. Media scanning handles subprocess/JSON errors through rejected promises, continues after individual corrupt files, deduplicates parent moves, and disables destination overwrites.

## Bundle result

See [measurements](008-bundle-measurements.md). Source and public-package distribution profiles execute assertions with both esbuild and Terser. Reports capture tool versions, lockfile hash and input hashes. Correctness fixes modestly increase some bundles. The measured lazy-binding experiment increased size and was rejected; no unproven runtime refactor was shipped.

## Dependency review

Unused fixture runners and example tooling are removed at their owning dependency boundaries. Compatible patch releases are preferred over broad overrides. Trivia has two static routes, one constant navigation target, and no SSR/hydration or splat routing. Its small v7 upgrade follows the [tagged React Router guide](https://raw.githubusercontent.com/remix-run/react-router/react-router@7.18.0/docs/upgrading/v6.md); React 18 and the repository Node version satisfy its requirements. This removes the v6-only dependency paths reported by [the navigation advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6) and [the SSR advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg). Current source inspection found no untrusted navigation target or SSR exposure in Trivia.

## Final verification

- Frozen workspace install and production build passed.
- Full source and built test suites each passed 3,138 tests (35 skipped, 3 todo).
- Typecheck, lint, formatting, Knip and Svelte Check passed. Svelte Check reported zero warnings.
- All seven public core code entrypoints passed strict built declaration checks.
- All 25 source and 25 public-package bundle profiles passed behavior assertions using both minifiers; verifier regression also passed.
- Four standalone template frozen installs/builds passed, with browser flows recorded separately.
- Exact `pnpm check:examples` passed: 49 projects including referenced configs, 49 build scripts, 91 Vitest tests across 49 files, six Node tooling tests, and one persistence CLI restart test.

Dependency audit: 136 advisories (4 critical, 68 high, 56 moderate, 8 low) reduced to seven (0 critical, 6 high, 1 moderate, 0 low). Dependencies: 2,293 to 1,482. All residual advisories concern Angular 19.2.25 development dependencies; the specified patched version, 19.2.26, returns E404 from the registry. Public Angular peer support remains on the supported 19.x line. No incompatible major override was used to hide the remaining reports.

The inspector update exposed that its v5 observer ignores store transition events. Commit `bb83aa2a85` replaces the example's direct observer with a stable callback through the inspector's public `snapshot()` method, updates documentation, and verifies actual delivery and unsubscribe cleanup. Trivia's patched router is browser-verified; direct visits and reloads return to the homepage when no game has started.

No remote CI result, live MongoDB integration, external email delivery, real media-library moves, packed-tarball verification, or exhaustive device testing is claimed.
