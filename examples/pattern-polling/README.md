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

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
