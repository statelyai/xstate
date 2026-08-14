# pattern-polling

## What it teaches

How to poll an external job for its status until it reaches a terminal state, with the wait-and-check loop modelled as states rather than a `while` loop.

## XState features used

- delayed transitions (`after`) as the poll interval
- `invoke` with `createAsyncLogic`
- branching in an `onDone` transition function
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The fake job API reports `succeeded` on the third poll.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each poll and status to stdout.
