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

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every attempt, failure and backoff delay to stdout.
