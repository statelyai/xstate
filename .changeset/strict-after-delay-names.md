---
'xstate': minor
---

When delays are declared (`setup({ delays })` or `createMachine({ delays })`), each `after` key must be a declared delay name, a number of milliseconds or a duration string such as `'5s'`. The error now names the offending key. Duration strings are no longer rejected when named delays are declared. Duration keys are checked against the forms the runtime parses: integer milliseconds (`'250ms'`), decimal seconds (`'1.5s'`) and ISO 8601 durations (`'PT1M30S'`). Malformed keys such as `'Pfoo'` or `'1.5ms'` are type errors.

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

At runtime, a delay that is neither a configured delay name nor a valid duration string now errors the actor with `Invalid delay "…"` instead of firing immediately.
