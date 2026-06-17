---
'xstate': minor
'@xstate/codemod': minor
---

Machine JSON revival now preserves more of the serialized machine definition, including delayed transitions, state timeouts, state tags, state output, invoke input, invoke completion transitions, invoke timeouts, and implementation maps passed to `createMachineFromConfig`.

```ts
const machine = createMachineFromConfig(
  {
    initial: 'loading',
    states: {
      loading: {
        invoke: {
          src: 'loadUser',
          input: { userId: '42' },
          onDone: { target: 'done' },
          timeout: 5000,
          onTimeout: { target: 'timedOut' }
        }
      },
      done: {},
      timedOut: {}
    }
  },
  {
    actors: { loadUser }
  }
);
```

The migration codemod now reports manual review notes for known non-rename migrations such as `fromPromise(...)`, `return assign(...)`, object-form actions/guards, and legacy `types: {}` schema declarations.
