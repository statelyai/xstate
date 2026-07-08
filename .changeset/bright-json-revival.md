---
'xstate': minor
---

Machine JSON revival now preserves more of the serialized machine definition, including delayed transitions, state timeouts, state tags, state output, route configs, invoke input, invoke completion transitions, invoke timeouts, expression values, and implementation maps passed to `createMachineFromConfig`.

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
    actorSources: { loadUser }
  }
);
```
