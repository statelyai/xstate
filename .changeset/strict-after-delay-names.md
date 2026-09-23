---
'xstate': minor
---

When delays are declared (`setup({ delays })` or `createMachine({ delays })`), each `after` key must be a declared delay name, a number of milliseconds or a duration string such as `'5s'`. The error now names the offending key. Duration strings are no longer rejected when named delays are declared.

```ts
setup({ delays: { retryDelay: 1_000 } }).createMachine({
  initial: 'waiting',
  states: {
    waiting: {
      after: {
        // Type error: Delay 'retryDelya' is not declared in delays.
        retryDelya: { target: 'retrying' }
      }
    },
    retrying: {}
  }
});
```

Fix the name, or declare the delay in `delays`.
