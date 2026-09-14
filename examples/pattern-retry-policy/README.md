# pattern-retry-policy

## What it teaches

How to retry a failing task with bounded attempts and exponential backoff, expressed as states instead of as retry logic hidden inside a promise.

## XState features used

- `invoke` `onError` routing
- named guards from `setup()`
- delayed transitions with a computed named delay (backoff)
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The fake service fails three times and then succeeds, so the run shows three backoffs and a success.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
