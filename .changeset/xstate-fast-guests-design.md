---
'xstate': major
---

All actor snapshots now have a consistent, predictable shape containing these common properties:

- `status`: `'active' | 'done' | 'error' | 'stopped'`
- `output`: The output data of the actor when it has reached `status: 'done'`
- `error`: The error thrown by the actor when it has reached `status: 'error'`
- `context`: The context of the actor

This makes it easier to work with actors in a consistent way, and to inspect their snapshots.

```ts
const promiseActor = fromPromise(async () => {
  return 42;
});

// Previously number | undefined
// Now a snapshot object with { status, output, error, context }
const promiseActorSnapshot = promiseActor.getSnapshot();

if (promiseActorSnapshot.status === 'done') {
  console.log(promiseActorSnapshot.output); // 42
}
```
