---
'@xstate/store': minor
---

Add async step support to `createStore(...)` with `await enq.step(stepId, exec)`.

```ts
const store = createStore({
  context: {
    result: undefined as number | undefined
  },
  on: {
    load: async (context, event: { id: string }, enq) => {
      const result = await enq.step('fetchResult', () => fetchResult(event.id));

      return {
        ...context,
        result
      };
    }
  }
});
```

This keeps `@xstate/store` aligned with its state-machine-like model: pending
async work is captured in the snapshot, and step completion is handled through
explicit followup events. That means an in-progress async transition can be
replayed deterministically from persisted snapshot state instead of depending on
an opaque promise continuation.
