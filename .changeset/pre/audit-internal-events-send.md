---
'xstate': patch
---

Events declared in `schemas.internalEvents` are now excluded from `actor.send` and `actor.trigger` in the published type declarations, matching the behavior already available when building against source. Both exact keys and wildcard keys are excluded.

```ts
const uploadMachine = setup({
  schemas: {
    events: { start: types<{}>() },
    internalEvents: {
      tick: types<{}>(),
      'progress.*': types<{ bytes: number }>()
    }
  }
}).createMachine({
  /* ... */
});

const actor = createActor(uploadMachine);

actor.send({ type: 'start' }); // ok
actor.send({ type: 'tick' }); // type error
actor.send({ type: 'progress.chunk', bytes: 256 }); // type error
actor.trigger.tick(); // type error: `tick` is not on `trigger`
```
