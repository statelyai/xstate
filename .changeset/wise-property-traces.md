---
'xstate': minor
'@xstate/fast-check': minor
---

Add exact property-test topology and transition coverage, configurable graph
frontiers, independent reference oracles, chronological runtime commands,
portable temporal replay, and human-readable traces.

```ts
const model = createTestModel(machine);
const result = await propertyTest(model, {
  adapter: fastCheckAdapter(),
  frontiers: {
    paths: model.getShortestPaths(),
    runsPerFrontier: 100
  },
  events,
  temporal: [
    {
      type: 'eventually',
      id: 'settles',
      within: 10,
      predicate: ({ snapshot }) => snapshot.matches('settled')
    }
  ],
  invariant
});

console.log(result.coverage.transitions);
```
