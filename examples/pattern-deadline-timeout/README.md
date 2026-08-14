# pattern-deadline-timeout

## What it teaches

How to put a deadline on a whole workflow: a root-level delayed transition cancels the order from whatever state it is in when the clock runs out.

## XState features used

- root-level `after` (workflow deadline)
- named delays
- event-driven transitions
- `invoke` for the compensating action
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The buyer confirms but never ships, so the deadline fires and the cancellation path runs.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each state change and the deadline firing to stdout.
