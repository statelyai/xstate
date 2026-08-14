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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every step and compensation to stdout.
