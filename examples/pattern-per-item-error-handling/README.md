# pattern-per-item-error-handling

## What it teaches

How to process a batch by spawning one child actor per item, so each item handles its own errors with its own compensation path and one failure never stops the batch.

## XState features used

- `enq.spawn` for one child actor per item
- `enq.subscribeTo` to turn child output into a parent event
- `invoke` `onError` routing to per-error-kind states
- child machine `output` aggregated by the parent
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Three orders are processed: one succeeds, one is missing an item, one has an invalid quantity.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each child's error handling and the batch summary to stdout.
