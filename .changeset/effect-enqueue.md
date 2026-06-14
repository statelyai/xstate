---
'@xstate/store': minor
---

Effects enqueued via `enq.effect(...)` now receive an enqueue object with `trigger`, `send`, and `getSnapshot`, so you can dispatch events back into the store after async work and read the latest state — without needing a reference to the store. This is especially useful with `createStoreLogic(...)`, where the store is created per-instance and there's no store to close over.

```ts
const storeLogic = createStoreLogic({
  context: () => ({ foo: null, loading: false }),
  on: {
    fetchFoo: (context, event, enq) => {
      enq.effect(({ trigger }) => {
        myApi.requestFoo().then((response) => trigger.gotFoo({ response }));
      });
      return { ...context, loading: true };
    },
    gotFoo: (context, event) => ({
      ...context,
      foo: event.response,
      loading: false
    })
  }
});
```

Use `trigger` for fully-typed dispatch; `send` is a loosely-typed escape hatch for dynamically-constructed events. After an `await`, the `context` argument is stale — use `getSnapshot()` to read the current state:

```ts
enq.effect(async ({ getSnapshot, trigger }) => {
  await someAsyncWork();
  if (getSnapshot().context.loading) {
    trigger.done();
  }
});
```
