# internal-events

## What it teaches

How `schemas.internalEvents` declares a private event protocol: events the machine raises for itself, which no caller can send in — rejected at the delivery boundary at runtime, and rejected by the types for exactly-named entries.

## XState features used

- `schemas.internalEvents`, including a `progress.*` wildcard entry
- `enq.raise` from a delayed transition
- `onRejectedEvent` on `createActor` options, the root actor's dead-letter hook
- the `@xstate.deadletter` inspection event
- the compile-time exclusion from `actor.send` and `actor.trigger` (a `@ts-expect-error` assertion in `src/main.ts`)
- delayed transitions (`after`), `reenter`, final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The upload machine accepts `start` and `cancel`. Its `progress.chunk` and `tick` events are internal: sending either from outside is rejected at the delivery boundary, so the printed state and byte count are unchanged, and the upload then completes on its own private protocol.

`send` is fire-and-forget. A rejected event does not throw at the call site and does not error the actor — the actor's status stays `active`. The rejection is only visible if you observe it, which the example does twice for each rejected send:

- `onRejectedEvent` receives an `EventRejection` with the `event`, `reason` (`'internalEvent'` here), `eventOrigin` and `error`.
- the `inspect` handler receives a `@xstate.deadletter` inspection event for the same rejection.

An exactly-named internal event is also a compile error, which is the first line of defence: `actor.trigger.tick({})` in `src/main.ts` is marked `@ts-expect-error`, and `pnpm typecheck` passes only because of it — remove the directive and `tsc` fails, which is the point. A wildcard entry such as `progress.*` is excluded from `actor.send` too — the `progress.chunk` send carries its own `@ts-expect-error` — and the runtime delivery boundary backs the compile-time check for untyped senders.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
