---
'xstate': minor
---

In development builds, machine snapshot context is now deep-frozen, so accidental in-place mutation throws a `TypeError` instead of silently corrupting state. Production builds do not freeze context.

```ts
const actor = createActor(
  createMachine({ context: { count: 0, items: [] as string[] } })
).start();

actor.getSnapshot().context.count = 1; // TypeError (development only)
actor.getSnapshot().context.items.push('a'); // TypeError (development only)
```

Only plain objects and arrays are frozen, including objects you put into context. Actor refs, class instances, `Map`, `Set` and `Date` are left as is. Update context by returning a new `context` from a transition instead of mutating it.
