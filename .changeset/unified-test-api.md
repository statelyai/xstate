---
'xstate': major
'@xstate/test': major
---

Path-based and property-based model testing in `xstate/graph` are now one API
with two ways of generating event sequences. `testPaths()` walks the machine's
state graph; `propertyTest()` generates random sequences. Both take the same
`events`, `sut`, `states`, `invariant`, `temporal`, and `reference` options,
return the same coverage object, and throw the same `ModelTestFailure`.

```ts
import { testPaths } from 'xstate/graph';

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

Breaking changes to `TestModel`:

- `path.test()` and `model.testPath()` take the same options as `testPaths()`
  instead of a `TestParam` (`{ events, states }`). Move event executors into a
  `sut`, or wrap the old object with `fromTestParam()`:

  ```ts
  // Before
  await path.test({
    events: { SUBMIT: ({ event }) => submit(event.value) },
    states: { submitted: () => expect(isSubmitted()).toBe(true) }
  });

  // After
  await path.test({
    sut: {
      create: () => ({
        send: (event) => (event.type === 'SUBMIT' ? submit(event.value) : undefined),
        states: { submitted: () => expect(isSubmitted()).toBe(true) }
      })
    }
  });

  // Or, unchanged executors
  await path.test({ sut: fromTestParam({ events, states }) });
  ```

  Executors passed to `fromTestParam()` receive the full typed event, so
  payload fields no longer need a cast.

- `path.test()` resolves with `TestPathRunResult` (`{ path, passed, error }`).
  `TestPathResult` and `TestStepResult` are removed; use the
  `ModelTestFailure` trace for per-step detail.
- `model.testState()` and `model.testTransition()` are removed. Use the
  `states` option, which runs after every stable step.

`model.testPaths(paths?, options?)` runs several paths through the same engine
as `testPaths()`. Functions in a state node's `meta.test` run on every stable
step, and receive the SUT session and the snapshot.
