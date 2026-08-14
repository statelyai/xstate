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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints its state and branch transitions to stdout.
