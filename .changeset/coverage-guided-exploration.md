---
'xstate': minor
'@xstate/fast-check': minor
---

Property tests can now stop on coverage, steer exploration toward what has not
been covered, and record statistics about the sequences they generate.

`until` stops a campaign as soon as the accumulated coverage is good enough.
Runs are executed in batches of `batchRuns` (default 25) up to `maxRuns`
(default 100), and the condition is checked between batches:

```ts
const { coverage } = await propertyTest(machine, {
  adapter: fastCheckAdapter(),
  events: { NEXT: fc.constant({}) },
  invariant,
  until: { transitions: 1, any: [{ guards: 1 }, { timeMs: 5_000 }] }
});

coverage.exploration.stoppedBecause; // 'until' | 'budget' | 'failure'
```

`frontiers: 'auto'` replays the shortest paths to the state nodes that still
own uncovered transitions, using them as the prefixes of the next batch.
Shrinking still only shortens the generated continuation.

`label(name, value?)` and `classify(condition, name)` are available on the
invariant, temporal, SUT, and reference contexts. Occurrences are aggregated
into `coverage.labels`, rendered by `formatPropertyCoverage()` and
`propertyCoverageToJSON()`, and can be required with `expectLabels`:

```ts
await propertyTest(machine, {
  adapter: fastCheckAdapter(),
  events: { WITHDRAW: fc.record({ amount: fc.integer({ min: 1 }) }) },
  invariant: ({ snapshot, classify }) => {
    classify(snapshot.context.balance === 0, 'emptied');
  },
  expectLabels: { emptied: { min: 0.1 } }
});
```

`PropertyTestFailure.message` now includes the formatted trace, so reporters
that print only the stack still show the counterexample. The short message
remains available as `PropertyTestFailure.summary`.
