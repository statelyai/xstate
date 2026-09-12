# pattern-parallel-branches

## What it teaches

How to run independent tasks concurrently in one workflow and continue only when every branch has finished, using a parallel state whose regions each invoke their own actor.

## XState features used

- parallel states
- region `onDone` (join)
- `invoke` with `createAsyncLogic`
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
