---
'xstate': minor
---

Development builds now report leftover v5 configuration (`cond`, `types`, string actions, …) with the v6 replacement instead of ignoring it.

```ts
// Before: `cond` was silently ignored, so the transition was always taken
createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: { submit: { target: 'sending', cond: ({ context }) => context.valid } }
    },
    sending: {}
  }
});
// Now throws: Transition "submit" in state "(machine).idle" uses "cond",
// which was removed. Use an inline transition function instead: ...

// After
createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        submit: ({ context }) => {
          if (!context.valid) return;
          return { target: 'sending' };
        }
      }
    },
    sending: {}
  }
});
```

`cond`, object-form `guard`, transition `actions`, non-function `entry`/`exit`, `types`, `tsTypes` and `schema` throw. `services`, `activities`, `predictableActionArguments`, `preserveActionOrder`, `strict` and `devTools` log a warning. Machines built with `createMachineFromConfig` or `createMachineFromSCXML` are not checked.
