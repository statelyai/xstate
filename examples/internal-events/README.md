# internal-events

## What it teaches

How `schemas.internalEvents` declares a private event protocol: events the machine raises for itself, which no caller can send in — enforced both by the types and at runtime.

## XState features used

- `schemas.internalEvents`, including a `progress.*` wildcard entry
- `enq.raise` from a delayed transition
- the compile-time exclusion from `actor.send` and `actor.trigger` (two `@ts-expect-error` assertions in `src/main.ts`)
- delayed transitions (`after`), `reenter`, final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The upload machine accepts `start` and `cancel`. Its `progress.chunk` and `tick` events are internal: sending either from outside throws before delivery, so the printed state and byte count are unchanged, and the upload then completes on its own private protocol.

Both rejected sends are also compile errors. `pnpm typecheck` passes only because each one is marked `@ts-expect-error` — remove a directive and `tsc` fails, which is the point.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
