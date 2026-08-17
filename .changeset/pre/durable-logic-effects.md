---
'xstate': minor
---

`createLogic` and `createAsyncLogic` gain a durable-effect enqueue API on their `run` function's second argument (`enq`).

- **`enq.effect(key?, fn)`** registers a side effect that runs once per key (an unnamed effect runs every transition) and is cleaned up when the actor stops.
- **`enq.step(key, asyncFn)`** (async logic) is an `await`-able step whose result is memoized into the persisted snapshot under `snapshot.effects[key]`. A rehydrated actor replays `run` but skips steps that already completed, so long-running async logic is resumable across persistence.

```ts
const logic = createAsyncLogic({
  run: async (_, enq) => {
    const user = await enq.step('fetchUser', () => fetchUser());
    const order = await enq.step('createOrder', () => createOrder(user.id));
    return order.id;
  }
});

// snapshot.effects.fetchUser === { status: 'done', output: { id: 1 } }
```

A pending step can also be resolved externally by sending `{ type: 'xstate.logic.effect.resolve', key, output }`. The `LogicEnqueue`, `LogicEffect`, and `LogicEffectState` types are exported.
