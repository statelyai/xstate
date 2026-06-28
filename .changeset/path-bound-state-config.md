---
'xstate': minor
---

Add a path-bound overload to `setup(...).createStateConfig(path, config)`.

When a state declares its own input schema, the anonymous `createStateConfig(config)` form types `input` as a broad union across all states. This makes the resulting config incompatible with the specific state it's meant for — assigning it inside `createMachine` produces a type error because the input types don't match.

The new `createStateConfig(path, config)` overload binds the config to a specific setup-declared state by dotted path (e.g. `'loading'` or `'parent.child'`). The addressed state's own input schema is used inside `entry`/`exit` args, and bare transition targets are validated against the state's siblings.

```ts
const s = setup({
  states: {
    idle: {},
    active: {
      schemas: { input: z.object({ userId: z.string() }) }
    }
  }
});

// Before: anonymous form — `input` is typed broadly, and assigning this
// config to the `active` state in createMachine fails with a type error.
const active = s.createStateConfig({
  entry: ({ input }) => {
    // input is not narrowed to { userId: string }
  }
});

// After: path-bound form — `input` is narrowed to `active`'s own schema.
const active = s.createStateConfig('active', {
  entry: ({ input }) => {
    input.userId; // string
  }
});

// Works for nested states too:
const child = s.createStateConfig('parent.child', { ... });
```
