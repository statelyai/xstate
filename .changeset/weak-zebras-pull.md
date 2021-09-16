---
'xstate': minor
---

Removed the ability to pass a model as a generic to `createMachine`, in favour of `model.createMachine`. This lets us cut an overload from the definition of `createMachine`, meaning errors become more targeted and less cryptic.

This means that this approach is no longer supported:

```ts
const model = createModel({});

const machine = createMachine<typeof model>();
```

If you're using this approach, you should use `model.createMachine` instead:

```ts
const model = createModel({});

const machine = model.createMachine();
```
