---
'@xstate/codemod': minor
---

`xstate-codemod migrate` accepts `--json`, which prints one JSON report to stdout. The command exits with code `2` when manual migration is needed, and the report lists each site under `manualSites` with its file, line, column, API, and hint.

A new report transform, `report-suffixed-lifecycle-events`, flags `on` keys written as `xstate.done.state.<id>`, `xstate.done.actor.<id>`, `xstate.error.actor.<id>`, or `xstate.after.<delay>.<id>`. v6 raises the plain event type with the id in a field, so those transitions never fire after migration. Another report transform, `report-action-shapes`, flags non-function `entry` and `exit` values, transition arrays, and transition `actions`, `guard`, and `cond` keys, which v6 rejects.

A new report transform, `report-implementations`, flags a second `createMachine` argument, which v6 ignores.

A new transform, `lower-actions`, rewrites v5 transitions with `actions` or `guard`, transition arrays, and `entry`/`exit` lists as v6 functions, converting `assign`, `enqueueActions`, `raise`, `sendTo`, `sendParent`, `forwardTo`, `emit`, `log`, `cancel`, `stopChild`, `spawnChild`, `and`, `or`, `not`, and `stateIn`, including named implementations and module-level constants defined in the same file. Named actions and guards keep their v5 signatures, and a named `assign` action becomes a function that returns a context patch. It also moves an object-literal second `createMachine` argument into the config and rewrites `fromPromise(fn)` as `createAsyncLogic({ run: fn })`. Code it cannot rewrite is left unchanged and reported.

```ts
// before
on: { INC: { target: 'active', guard: 'canInc', actions: assign({ count: ({ context }) => context.count + 1 }) } }
// after
on: {
  INC: (args) => {
    if (!args.guards.canInc(args)) return;
    return { target: 'active', context: { count: args.context.count + 1 } };
  }
}
```

`types-to-schemas` converts the per-key form `types: { context: {} as C, events: {} as E }`, builds an events map from same-file type aliases, and writes `events: types<E>()` for other event types instead of leaving `types` in place.

New `baseline` and `verify` commands check that a migrated machine behaves like the v5 original. `baseline` records a trace of generated event sequences under XState v5, and `verify` replays them against the v6 module and reports the diffs.

`baseline` and `verify` accept `--input <file>`, a JSON value passed as the machine's `input`. While a machine runs, `Date.now()`, `performance.now()`, and `Math.random()` return simulated, seeded values, so machines that store them in `context` compare equal, and a v5 root actor's `sendParent` error is classified as the intentional `root-send-parent` delta. `--no-simple-paths` skips the graph's simple paths when `baseline` times out.

```bash
npx @xstate/codemod baseline src/checkout.ts --out .xstate-migrate/checkout.json
npx @xstate/codemod migrate src/checkout.ts --json
# fix the reported manualSites
npx @xstate/codemod verify --baseline .xstate-migrate/checkout.json src/checkout.ts
```

`migrate` reports string literals that name v5 inspection event types (`@xstate.snapshot`, `@xstate.event`, `@xstate.action`, `@xstate.microstep`, `@xstate.deadletter`), which v6 never emits.
