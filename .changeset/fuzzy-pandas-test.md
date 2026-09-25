---
'xstate': minor
'@xstate/test': minor
---

Added generator-neutral property testing to `xstate/graph`, with a fast-check
adapter in `@xstate/test`. `propertyTest()` runs generated event and command sequences through the
pure transition path and checks invariants and temporal properties, with
portable replay fixtures, graph frontiers, coverage reporting, and optional
reference-oracle and SUT equivalence. Counterexample shrinking is provided by
fast-check. An optional `@xstate/test/effect-schema` entrypoint turns
Effect Schemas into event payload arbitraries.

```ts
await propertyTest(createTestModel(machine), {
  events: {
    INC: fc.record({ value: fc.integer() })
  },
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeLessThan(100);
  }
});
```
