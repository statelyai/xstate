---
'xstate': minor
'@xstate/fast-check': minor
---

Add generator-neutral property testing to `xstate/graph` and a FastCheck
adapter with shrinking, replay, graph frontiers, coverage, schema generation,
and optional SUT equivalence.

```ts
await propertyTest(createTestModel(machine), {
  adapter: fastCheckAdapter(),
  events: {
    INC: fc.record({ value: fc.integer() })
  },
  invariant: ({ snapshot }) => {
    expect(snapshot.context.count).toBeLessThan(100);
  }
});
```
