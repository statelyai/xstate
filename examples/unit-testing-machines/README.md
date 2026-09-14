# unit-testing-machines

## What it teaches

How to test a machine at three levels: pure transitions with no actor, a running actor with its invoked logic replaced, and a delayed transition driven by a simulated clock.

## XState features used

`initialTransition` / `transition` (pure), `setup()` with named actors, `machine.provide()`, `invoke` with `onDone` / `onError`, delayed transitions (`after`), `SimulatedClock`, `toPromise`.

## The three levels

**Pure transitions.** `initialTransition(machine)` and `transition(machine, snapshot, event)` return `[snapshot, actions]`. Nothing is executed, so guard and context logic can be asserted synchronously.

```ts
const [initial] = initialTransition(feedbackMachine);
const [next] = transition(feedbackMachine, initial, { type: 'submit' });
expect(next.value).toBe('editing'); // incomplete draft, so no transition
```

**A running actor with stubbed logic.** `machine.provide({ actors: … })` returns a copy of the machine with named sources replaced. The invoke must reference the actor by name (`src: ({ actors }) => actors.submitFeedback`) for `provide` to reach it.

```ts
const succeeds = feedbackMachine.provide({
  actors: {
    submitFeedback: createAsyncLogic({ run: async () => ({ id: 'fb-4' }) })
  }
});
```

**Delays.** Pass a `SimulatedClock` as the `clock` option to `createActor` and move time forward by hand. A three-second retry is verified instantly and without flakiness.

```ts
const actor = createActor(machine, { clock: new SimulatedClock() }).start();
clock.increment(RETRY_DELAY);
```

## Run it

```bash
pnpm install
pnpm test
```

## Inspect it

This example has no long-lived actor to inspect; the tests create and stop their own. To watch a test run in the [Stately Inspector](https://stately.ai/docs/inspector), pass `inspect` to `createActor` in the test and open https://stately.ai/registry/inspect.
