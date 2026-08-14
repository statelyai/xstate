# agent-model-fallback

## What it teaches

Provider failover for model calls: try the primary model, fail over to a secondary and then a tertiary, with a per-provider retry-and-backoff budget and a circuit-open state when every provider is down.

## XState features used

- an invoked child machine per provider, with `output` reporting `ok` instead of throwing
- named guard for the retry budget and a computed named delay for backoff
- `onError` routing inside the child, failover as transitions in the parent
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The primary provider fails both attempts, the secondary times out once and then answers, so the run shows a failover and a successful retry.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every attempt, failure, backoff and failover to stdout.
