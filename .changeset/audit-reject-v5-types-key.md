---
'xstate': patch
---

A leftover v5 `types` key in a machine config is now a compile error instead of being accepted and silently ignored. The error names the replacement:

```ts
createMachine({
  // Error: `types` was replaced by `schemas` in v6. Declare `context`,
  // `events` and the other contracts under `schemas`, or run
  // `xstate-codemod migrate --transform types-to-schemas`.
  types: {} as { context: { count: number } },
  context: { count: 0 }
});
```

Declare the contracts under `schemas` instead:

```ts
createMachine({
  schemas: { context: types<{ count: number }>() },
  context: { count: 0 }
});
```
