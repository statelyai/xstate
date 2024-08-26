---
'@xstate/svelte': patch
'@xstate/react': patch
'@xstate/solid': patch
'@xstate/vue': patch
'xstate': patch
---

Updated types of `useActor`, `useMachine`, and `useActorRef` to require `input` when defined inside `types/input`.

Previously even when `input` was defined inside `types`, `useActor`, `useMachine`, and `useActorRef` would **not** make the input required:

```tsx
const machine = setup({
  types: {
    input: {} as { value: number }
  }
}).createMachine({});

function App() {
  // Event if `input` is not defined, `useMachine` works at compile time, but risks crashing at runtime
  const _ = useMachine(machine);
  return <></>;
}
```

With this change the above code will show a type error, since `input` is now required:

```tsx
const machine = setup({
  types: {
    input: {} as { value: number }
  }
}).createMachine({});

function App() {
  const _ = useMachine(machine, {
    input: { value: 1 } // Now input is required at compile time!
  });
  return <></>;
}
```

This avoids runtime errors when forgetting to pass `input` when defined inside `types`.
