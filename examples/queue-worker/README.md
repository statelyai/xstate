# queue-worker

## What it teaches

How to run a bounded worker pool: a parent actor pulls jobs from an in-memory queue, keeps at most N job actors alive at a time, retries each failing job with backoff, and dead-letters a job that exhausts its attempts.

## XState features used

- `enq.spawn` with `enq.subscribeTo` for per-job child actors
- `invoke` `onError` routing and a named `canRetry` guard
- delayed transitions with a computed backoff delay
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Eight jobs run through a pool of two workers. One job succeeds on its third attempt; one keeps failing and is dead-lettered.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
