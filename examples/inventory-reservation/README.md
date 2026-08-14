# inventory-reservation

## What it teaches

How to hold stock with a TTL: each reservation is its own actor whose expiry is a delayed transition, extending a hold restarts that timer, and an overselling guard keeps the parent from granting stock it does not have.

## XState features used

- `after` with `reenter: true` for a restartable TTL
- `enq.spawn`, `enq.subscribeTo`, and `enq.sendTo` with refs kept in context
- named guard (`inStock`) preventing overselling
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Two customers race for the last unit. The second is denied, the first hold expires and returns the unit to stock, and the second customer then reserves, extends and commits.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every grant, denial, extension and settlement to stdout.
