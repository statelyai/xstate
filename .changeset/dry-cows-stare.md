---
'xstate': minor
---

Add `setup().createAction(…)` helper for type-safe custom actions.
Allow wrapping built-ins with `createAction` (e.g. `createAction(assign(...))` or `createAction(raise(...))`).

```ts
const machineSetup = setup({
  types: {} as {
    context: {
      count: number;
    };
    events: { type: 'inc'; value: number };
  }
});

const action = machineSetup.createAction(({ context, event }) => {
  console.log(context.count, event.value);
});

const incrementAction = machineSetup.createAction(
  assign({ count: ({ context }) => context.count + 1 })
);

const machine = machineSetup.createMachine({
  context: { count: 0 },
  entry: [action, incrementAction]
});
```
