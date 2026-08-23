---
'xstate': minor
---

Guard and delay source functions are now contextually typed from `schemas` — in `setup({ ... })`, `.extend({ ... })`, and `createMachine({ ... })` — so inline functions get typed `context` and `event` without hand annotations:

```ts
const s = setup({
  schemas: {
    context: z.object({ count: z.number() }),
    events: { INC: z.object({ by: z.number() }) }
  },
  guards: {
    // context: { count: number }, event: { type: 'INC'; by: number }
    isPositive: ({ context }) => context.count > 0,
    // additional params after the args object are free-form
    isAbove: ({ context }, threshold: number) => context.count > threshold
  },
  delays: {
    backoff: ({ context }) => context.count * 100
  }
});
```

Guard sources receive the transition args object first (`{ context, event, self, parent, value, children }`), followed by any caller-supplied params — matching how the runtime invokes referenced guards. Delay sources receive `{ context, event, stateNode }`.

Additionally, `enq.stop(...)`, `enq.listen(...)`, and `enq.subscribeTo(...)` now accept any `ActorRef` (such as values typed with `ActorRefFrom<typeof machine>`), instead of requiring the full actor instance type returned by `enq.spawn(...)`.
