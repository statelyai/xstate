# model-based-testing

## What it teaches

How to generate tests from a machine with `xstate/graph`: the machine is the model, path generation enumerates the flows through it, and every generated path becomes a vitest case that drives a separate system under test.

## XState features used

`createTestModel` and `getShortestPaths` from the `xstate/graph` subpath, the `events` sample set (one entry per equivalence class, payloads included), `getSimplePaths()`, `path.test({ states, events })`, `path.steps` / `path.state` / `path.description`, and replaying a generated path through a real `createActor`.

## How it works

**The model.** `checkoutMachine.ts` is a cart → shipping → payment → confirmed flow with a decline branch. Transition functions branch on the event payload, so one event type covers two outcomes.

**The system under test.** `checkoutUi.ts` is a plain imperative class that knows nothing about XState. In a real project this would be a component driven through Testing Library, or an HTTP client.

**Sample events.** Path generation needs concrete events, so pass one per equivalence class — including the payloads that select each branch:

```ts
const testModel = createTestModel(checkoutMachine, {
  events: [
    { type: 'submitAddress', zip: '02134' }, // valid
    { type: 'submitAddress', zip: 'nope' }, // invalid
    { type: 'pay', card: '4111111111111111' } // approved
    // …
  ]
});
```

**Paths become test cases.** `getSimplePaths()` returns non-looping paths. `path.test()` runs each step: the event executor drives the UI, then the matching `states` assertion checks the UI against the model snapshot the machine reached.

```ts
it.each(paths.map((path) => [path.description, path] as const))(
  '%s',
  async (_description, path) => {
    const ui = new CheckoutUi();
    await path.test({
      events: { back: () => ui.back() /* … */ },
      states: { payment: () => expect(ui.screen).toBe('payment') /* … */ }
    });
  }
);
```

Add a state or a transition to the machine and new test cases appear without writing any.

Event executors receive the event narrowed to its `type`, so payloads are read back through the machine's event union (`Extract<CheckoutEvent, { type: 'pay' }>`).

## Run it

```bash
pnpm install
pnpm test
```

## Inspect it

There is no long-lived actor here; the tests generate paths and create their own actors. To watch a replayed path, pass `inspect` to `createActor` in the last test and open https://stately.ai/registry/inspect.
