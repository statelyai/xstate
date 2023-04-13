---
'xstate': major
---

The machine `.schema` property is now `.types`:

```ts
const machine = createMachine({
  // schema: { ... }
  types: {} as {
    context: { ... };
    events: { ... };
    // ...
  }
});
```

And the `.tsTypes` property is now `.types.typegen`:

```ts
const machine = createMachine({
  // tsTypes: { ... }
  types: {} as {
    typegen: {};
    context: { ... };
    events: { ... };
    // ...
  }
});
```
