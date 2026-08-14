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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every grant, queue and refill to stdout.
