---
'xstate': minor
'@xstate/fast-check': minor
---

Extend `propertyTest()` with fresh model-testing sessions, multiple named cases
per event type, and symbolic event values resolved from the current model
snapshot. Model-testing event executors now receive the complete typed event.

```ts
await propertyTest(createTestModel(machine), {
  adapter: fastCheckAdapter(),
  events: {
    USE_ACCOUNT: {
      case: 'existing-account',
      generate: fc.nat(),
      resolve: ({ snapshot, generated }) => {
        const ids = snapshot.context.accountIds;
        return ids.length
          ? { accountId: ids[(generated as number) % ids.length] }
          : undefined;
      }
    }
  },
  test: {
    create: () => ({ params: modelTestParams, dispose: stopApplication })
  },
  invariant
});
```
