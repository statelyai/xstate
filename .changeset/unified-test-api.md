---
'@xstate/test': major
---

Path-based and property-based model testing in `@xstate/test` are one API
with two ways of generating event sequences. `testPaths()` walks the machine's
state graph; `propertyTest()` generates random sequences. Both take the same
`events`, `sut`, `states`, `invariant`, `temporal`, and `reference` options,
return the same coverage object, and throw the same `ModelTestFailure`.

```ts
import { testPaths } from '@xstate/test';

const { coverage, results } = await testPaths(machine, {
  pathGenerator: 'simple',
  events: {
    ADD: [
      { case: 'apple', generate: () => ({ sku: 'apple' }) },
      { case: 'pear', generate: () => ({ sku: 'pear' }) }
    ]
  },
  sut: {
    create: () => {
      const cart = createCart();
      return {
        send: (event) => cart.dispatch(event),
        read: () => cart.items()
      };
    },
    projectModel: (snapshot) => snapshot.context.items
  }
});
```

`testPaths()` resolves with `{ coverage, results }`, where each result is
`{ path, passed, error }`, and throws a `ModelTestFailure` with a trace, a
portable replay fixture, and coverage on the first failing path. Event
generators are sampled into `samples` (default `3`) payloads per event case
before traversal, seeded by `seed`. The graph includes `onDone`, `onError`,
and `after` transitions: in pure mode they are sent as internal events, and
with `mode: 'executed'` they become stubbed actor outcomes and clock advances.

`testPaths()` also accepts a `TestModel` from `xstate/graph`; pass `paths` to
run specific paths. Functions in a state node's `meta.test` run on every stable
step, and receive the SUT session and the snapshot. `fromTestParam({ events,
states })` converts a 1.0 beta `TestParam` object to a `sut`; executors receive
the full typed event.
