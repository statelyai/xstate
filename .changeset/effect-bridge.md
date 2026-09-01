---
'@xstate/effect': minor
'xstate': patch
---

Add experimental Effect 4 integration for XState v6, including Effect-backed actors, streams, typed requirements and failures, Effect actions, and direct Effect Schema support in `setupEffect` and `fromEffect`.

```ts
const loadUser = fromEffect({
  schemas: {
    input: Schema.Struct({ id: Schema.String }),
    output: Schema.Struct({ id: Schema.String })
  },
  effect: ({ input }) => Effect.succeed({ id: input.id })
});
```
