# actor-system

## What it teaches

The actor system as a receptionist: actors register under a key and any other actor in the system looks them up with `system.get(key)`, instead of references being threaded through context.

## XState features used

- `createSystem({ registry })` and `system.setup()`
- `registryKey` on `invoke`
- `system.get(key)` from a transition function and from inside a callback actor
- `system.getAll()`, `system.createActor`
- `createCallbackLogic`, final state `output`, `toPromise`

## How it works

The registry declares the keys and the logic behind each one, which is what makes `system.get('logger')` typed:

```ts
const system = createSystem({ registry: { logger, notifier } });
const orderMachine = system.setup({ … }).createMachine({ … });
```

Children become discoverable by being invoked (or spawned) with a `registryKey`. The order machine sends to them with `enq.sendTo(system.get('notifier'), …)`, and the notifier reaches the logger the same way from inside its callback — the two leaf actors never hold a reference to each other.

`system` is optional in entry action arguments but not in transition functions, so the entry action in this example reads it with `?.`.

## Run it

```bash
pnpm install
pnpm start
```

The demo creates an order, pays it, and ships it, printing the logger and notifier output as it goes.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
