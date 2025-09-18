---
'xstate': minor
---

Add type-bound action helpers to `setup()`:

- `createAction(fn)` – create type-safe custom actions
- `setup().assign(...)`, `setup().sendTo(...)`, `setup().raise(...)`, `setup().log(...)`, `setup().cancel(...)`, `setup().stopChild(...)`, `setup().enqueueActions(...)`, `setup().emit(...)`, `setup().spawnChild(...)` – setup-scoped helpers that are fully typed to the setup's context/events/actors/guards/delays/emitted.

These helpers return actions that are bound to the specific `setup()` they were created from and can be used directly in the machine produced by that setup.

```ts
const machineSetup = setup({
  types: {} as {
    context: {
      count: number;
    };
    events: { type: 'inc'; value: number } | { type: 'TEST' };
    emitted: { type: 'PING' };
  }
});

// Custom action
const action = machineSetup.createAction(({ context, event }) => {
  console.log(context.count, event.value);
});

// Type-bound built-ins (no wrapper needed)
const increment = machineSetup.assign({
  count: ({ context }) => context.count + 1
});
const raiseTest = machineSetup.raise({ type: 'TEST' });
const ping = machineSetup.emit({ type: 'PING' });
const batch = machineSetup.enqueueActions(({ enqueue, check }) => {
  if (check(() => true)) {
    enqueue(increment);
  }
});

const machine = machineSetup.createMachine({
  context: { count: 0 },
  entry: [action, increment, raiseTest, ping, batch]
});
```
