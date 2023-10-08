---
'xstate': minor
---

You can now stop multiple actors in the `stop(...)` action creator:

```ts
const machine = createMachine({
  types: {
    context: {} as {
      actors: Array<AnyActorRef>;
    }
  },
  context: ({ spawn }) => {
    return {
      actors: [
        spawn(fromPromise(() => Promise.resolve('foo'))),
        spawn(fromPromise(() => Promise.resolve('bar'))),
        spawn(fromPromise(() => Promise.resolve('baz')))
      ]
    };
  },
  on: {
    stopAll: {
      // Return a single actorRef or an array of actorRefs
      actions: stop(({ context }) => context.actors)
    }
  }
});
```
