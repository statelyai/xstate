# pattern-event-accumulation

## What it teaches

How to accumulate a stream of incoming events into context over a bounded window, then compute a result when the window closes — here, collecting auction bids and picking the winner.

## XState features used

- transition functions returning context patches
- rejecting an event by returning `undefined` (no transition)
- delayed transition as the closing deadline
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Bids arrive over a two-second window; one is too low and one arrives after closing.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every accepted and rejected bid to stdout.
