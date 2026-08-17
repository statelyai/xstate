---
'xstate': major
---

`setup(...)` now focuses on machine- and state-level typing: it validates state keys, `initial`, and transition `target`s against declared `states`, and types per-state `input`/`context`.

It accepts `{ schemas?, states?, actors?, actions?, guards?, delays? }` and returns `{ createMachine, createStateConfig, extend, states }`. Use `setup.extend(...)` to compose setup definitions before creating a machine.

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

```ts
const base = setup({
  guards: {
    isReady: () => true
  }
});

const extended = base.extend({
  actions: {
    trackReady: () => {}
  }
});
```

`setup().createMachine()` merges setup definitions with config definitions. Bare `createMachine({ schemas })` infers the same machine-level types without the state-key checks.
