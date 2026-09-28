# model-based-testing

## What it teaches

How to generate tests from a machine with `@xstate/test` and `xstate/graph`: the machine is the model, path generation enumerates the flows through it, and every path drives a separate system under test.

## XState features used

`testPaths()` and `propertyTest()` from `@xstate/test`, event cases with `when`, a `TestSut` with `read()` and `projectModel()`, `getSimplePaths()` and `getShortestPaths()` from `xstate/graph`, `path.steps` and `path.state`, and replaying a path through a real `createActor`.

## How it works

**The model.** `checkoutMachine.ts` is a cart → shipping → payment → confirmed flow with a decline branch. Transition functions branch on the event payload, so one event type covers two outcomes.

**The system under test.** `checkoutUi.ts` is a plain imperative class that knows nothing about XState. In a real project this would be a component driven through Testing Library, or an HTTP client.

**Event cases.** Each event type lists one case per equivalence class, including the payloads that select each branch. `when` limits each case to the states where the UI offers it:

```ts
const events = {
  submitAddress: [
    {
      case: 'valid zip',
      generate: fc.constant({ zip: '02134' }),
      when: enabled
    },
    {
      case: 'invalid zip',
      generate: fc.constant({ zip: 'nope' }),
      when: enabled
    }
  ]
  // …
};
```

**The SUT.** `create()` returns a session whose `send()` drives the UI. After every step, `read()` is compared with `projectModel(snapshot)`, and the `states` assertions for the current state run:

```ts
const checkoutSut: TestSut<CheckoutSnapshot, CheckoutEvent> = {
  create: () => {
    const ui = new CheckoutUi();
    return {
      send: (event) => {
        /* … */
      },
      read: () => ({ screen: ui.screen, zip: ui.zip, error: ui.error })
    };
  },
  projectModel: (snapshot) => ({
    screen: snapshot.value,
    zip: snapshot.context.zip,
    error: snapshot.context.error
  })
};
```

**Paths become test cases.** `testPaths(checkoutMachine, { pathGenerator: 'simple', events, sut })` runs every simple path. The test file also calls `getSimplePaths()` from `xstate/graph` and passes each path to `testPaths(checkoutMachine, { paths: [path], sut })`, so each path is its own vitest case. Add a state or a transition to the machine and new test cases appear without writing any.

**Random sequences.** Simple paths visit each state once, so they never take `retry` from `declined` back to `payment`. `propertyTest()` sends random sequences of the same events and reports the `retry` transition as covered.

## Run it

```bash
pnpm install
pnpm test
```

## Inspect it

There is no long-lived actor here; the tests generate paths and create their own actors. To watch a replayed path, pass `inspect` to `createActor` in the last test and open https://stately.ai/registry/inspect.
