---
'xstate': minor
---

Children declared in `schemas.children` now contribute their completion events to the event union seen by `entry`, `exit`, guards and transition functions. `assertEvent(event, 'xstate.done.actor')` narrows `event.output` to the child's output type, and `event.actorId` to the declared ids.

```ts
setup({
  actors: { fetchUser },
  schemas: {
    children: { fetch: z.custom<ActorRefFromLogic<typeof fetchUser>>() }
  }
}).createMachine({
  invoke: { id: 'fetch', src: 'fetchUser' },
  entry: ({ event }) => {
    assertEvent(event, 'xstate.done.actor');
    event.output.name; // string
  }
});
```

Code that assumed every event in these positions is a declared public event may need a narrowing check first.
