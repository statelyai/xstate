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

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
