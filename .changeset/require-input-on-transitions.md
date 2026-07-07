---
'xstate': minor
---

Transitions that target a state declaring `schemas.input` now **require** an `input` property, enforced at the type level. This applies to `on`, `always`, `after`, `onTimeout`, `onDone`, `onError`, invoke handlers, and the object form of `initial`.

```ts
const machine = setup({
  states: {
    loading: {
      schemas: { input: z.object({ userId: z.string() }) }
    }
  }
}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        // Before: LOAD: { target: 'loading' }  — now a type error
        LOAD: { target: 'loading', input: { userId: 'user-1' } }
      }
    },
    loading: {}
  }
});
```

This is a breaking type change: machines that transition to an input-declaring sibling without providing `input` will no longer type-check — add the required `input`.

At runtime, if `input` is provided on a transition whose target is not actually re-entered — for example a self-transition without `reenter: true` — the input is now ignored (previously it was stored but never applied) and a development-only warning is logged. Add `reenter: true` to re-enter the state and apply the input.

Enforcement applies to direct sibling-key targets. Targets via `#id`, relative `.child`, or arrays (`{ target: [...] }`) are not correlated to a schema at the type level, so `input` stays optional there. Input schemas with no required fields still require an explicit `input` (e.g. `input: {}`).
