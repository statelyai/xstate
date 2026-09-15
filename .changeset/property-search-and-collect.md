---
'xstate': minor
'@xstate/fast-check': minor
---

Property testing gained swarm testing, targeted search, and a per-run `collect` hook.

`swarm` restricts each run to a seeded random subset of the declared event cases, so rare interleavings are not crowded out by the most common events. The enabled case ids are recorded on the trace and on replay fixtures, and the subset is frozen once a run fails, so shrinking is unaffected.

```ts
const { coverage } = await propertyTest(machine, {
  adapter: fastCheckAdapter({ numRuns: 200 }),
  events,
  invariant,
  swarm: true
});

coverage.exploration.swarm; // { runs, averageEnabled }
```

`target(observation, label?)` is available anywhere `label()` is, with `target` as the shorthand for recording on every step. With `frontiers: { strategy: 'target' }`, the prefixes that reached the best observed values become the frontiers of the next batch, so a value that needs more events than one run allows is still reachable:

```ts
const { coverage } = await propertyTest(counterMachine, {
  adapter: fastCheckAdapter({ maxCommands: 6 }),
  events: { INC: fc.constant({}), DEC: fc.constant({}) },
  invariant,
  target: ({ snapshot }) => snapshot.context.count,
  frontiers: { strategy: 'target' },
  until: (coverage) => coverage.exploration.target.best >= 8
});

coverage.exploration.target; // { best, label, improvements }
```

`collect(trace, { passed, runIndex })` is called after every run finishes, which is how offline suites now record their fixtures.

`replayPropertyTest()` accepts `expect: 'failure' | 'pass'` and throws the typed `PropertyReplayNotReproducedError` (with a `step`) when a recorded failure no longer reproduces. Replay fixtures recorded from a passing run no longer carry a `failedAt` step.
