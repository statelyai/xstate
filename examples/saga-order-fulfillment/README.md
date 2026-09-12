# saga-order-fulfillment

## What it teaches

How to model a distributed transaction as a saga: each forward step has a matching compensation state, and a failure unwinds only the steps that already completed.

## XState features used

- sequential `invoke` steps with `onDone` / `onError` routing
- compensation states entered from the failure path
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The first order reserves inventory, charges the card and schedules shipping. The second order fails at payment, so the reservation is released and the saga ends in `rolledBack`.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
