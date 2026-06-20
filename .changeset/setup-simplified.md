---
'xstate': major
---

`setup(...)` no longer registers implementations. It now takes only `{ schemas?, states? }` and returns `{ createMachine, createStateConfig, states }`.

In v5, `setup({ schemas, actors, actions, guards, delays })` registered named implementations and returned action creators (`assign`, `sendTo`, `raise`, …). In v6, actions/guards/actors/delays are plain inline functions, so `setup` no longer accepts or returns them. Its job is now machine- and state-level typing: it validates state keys, `initial`, and transition `target`s against the declared `states`, and types per-state `input`/`context`.

```ts
const { createMachine, createStateConfig } = setup({
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{ value: number }>() }
  },
  states: {
    idle: {},
    loading: { schemas: { input: z.object({ userId: z.string() }) } }
  }
});
```

`setup().createMachine()` merges setup `schemas` with config `schemas`. Bare `createMachine({ schemas })` infers the same machine-level types without the state-key checks.
