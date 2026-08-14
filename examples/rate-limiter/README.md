# rate-limiter

## What it teaches

How to express a token bucket as a machine: tokens refill on a delayed transition, a guard decides whether an `acquire` is granted immediately, and requests that miss out queue up until a refill releases them.

## XState features used

- `after` with `reenter: true` to rearm the refill timer
- named guard (`hasToken`) inside a transition function
- a waiter queue in context
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Ten requests arrive at once against a bucket of capacity three: three are granted immediately and the remaining seven are released one refill at a time.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
