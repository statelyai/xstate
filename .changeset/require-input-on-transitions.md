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

A self-transition without `reenter: true` does not re-enter its target, so `input` stays **optional** there — the state keeps its current input and providing a new value has no effect (at runtime the new value is ignored). Add `reenter: true` to actually re-enter the state and apply the new input; re-entering self-transitions require `input` just like transitions to other input-schema states.

Enforcement applies to direct sibling-key targets. Targets via `#id`, relative `.child`, or arrays (`{ target: [...] }`) are not correlated to a schema at the type level, so `input` stays optional there. Input schemas with no required fields still require an explicit `input` (e.g. `input: {}`).
