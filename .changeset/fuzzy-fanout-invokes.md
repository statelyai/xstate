---
'xstate': patch
---

Add fanout invokes with `items`, `join`, `concurrency`, and `key` for running one actor source over multiple inputs. Fanout invokes are fully persistable: `getPersistedSnapshot()` captures the in-flight and pending items, and restoring resumes mid-flight without re-running already-settled items.

```ts
createMachine({
  actorSources: {
    fetchUser
  },
  invoke: {
    src: 'fetchUser',
    items: [{ userId: 'a' }, { userId: 'b' }],
    join: 'all',
    concurrency: 4,
    onDone: ({ output }) => {
      console.log(output);
    }
  }
});
```

`join` supports:

- `'all'` (default) — resolves with all outputs in item order; rejects on the first error.
- `'allSettled'` — resolves with a `{ status, output | error, key, index }` result per item, so each settled entry can be traced back to its source item.
- `'race'` — settles with the first item to settle (fulfill or reject).
- `'any'` — resolves with the first item to fulfill; rejects with an aggregated error only if every item rejects.

Fanout invokes also support live observability:

- `onSnapshot` receives the fanout actor's snapshot as items settle, exposing `context.settledCount` and `context.settled` for progress reporting.
- Events emitted by item actors are forwarded to the parent, each augmented with its item identity as `{ ...emittedEvent, fanout: { key, index } }`.
