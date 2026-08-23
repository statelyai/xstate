# v5-to-v6-migration

## What it teaches

The same feedback machine written twice — [in v5](./V5.md) and [in v6](./src/main.ts) — with a table mapping each v5 API to its v6 replacement.

## XState features used

`setup()` with `schemas` and `types<T>()`, transition functions in place of `guard`, context patches in place of `assign`, `createAsyncLogic`, `invoke` with `onDone` / `onError`, final state `output`, `toPromise`.

## v5 → v6

| v5                                                     | v6                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `setup({ types: {} as { context; events } })`           | `setup({ schemas: { context: types<T>(), events: { … } } })`                           |
| `{ guard: 'isComplete', target: 'x' }`                  | a transition function: `({ context, guards }) => guards.isComplete({ context }) ? { target: 'x' } : undefined` |
| `actions: assign({ rating: ({ event }) => … })`         | return a context patch: `({ event }) => ({ context: { rating: event.rating } })`       |
| `actions: raise / sendTo / emit / stopChild / cancel`   | `enq.raise` / `enq.sendTo` / `enq.emit` / `enq.stop` / `enq.cancel`                    |
| `assign(({ spawn }) => …)`                              | `enq.spawn(logic, options)`, or `spawn` in the `context` factory                       |
| `fromPromise(async ({ input }) => …)`                   | `createAsyncLogic({ run: async ({ input }) => … })`                                    |
| `fromCallback`                                          | `createCallbackLogic`                                                                  |
| `fromObservable` / `fromEventObservable`                | `createObservableLogic` / `createEventObservableLogic`                                 |
| `fromTransition`                                        | `createLogic` (reducer-style logic with `context` and `run`)                            |
| `getNextSnapshot(logic, snapshot, event)`               | `transition(logic, snapshot, event)`; `getNextSnapshot` still exists but is deprecated |
| `useMachine(machine)` (`@xstate/react`)                 | `useActor(machine)`; `useMachine` remains as a deprecated alias                        |
| `machine.provide({ actions, actors, guards, delays })`  | unchanged                                                                              |

`assign`, `raise`, `sendTo`, `fromPromise`, and the other v5 action and actor creators are no longer exported from `xstate`. The `create*Logic` creators are exported from `xstate` and from the `xstate/actors` subpath.

## Run it

```bash
pnpm install
pnpm start
```

The demo sends an incomplete `submit` (which the transition function ignores), fills in the draft, submits again, and prints the final output.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
