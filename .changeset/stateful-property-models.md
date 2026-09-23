---
'xstate': minor
'@xstate/test': minor
---

`propertyTest()` accepts several named cases per event type, and symbolic
event values resolved from the current model snapshot. Each run creates a
fresh system-under-test session.

```ts
await propertyTest(createTestModel(machine), {
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
  sut: {
    create: () => {
      const app = startApplication();
      return {
        send: (event) => app.dispatch(event),
        dispose: () => app.stop()
      };
    }
  },
  invariant
});
```

fast-check shrinks the generated value, and the resolved event is what gets
recorded, so replay fixtures do not depend on the resolver. Returning
`undefined` from `resolve` makes the case inapplicable for that step.
