# webhook-processor

## What it teaches

How to process incoming webhook deliveries safely: dedupe by delivery id against an idempotency set in context, verify the signature before doing any work, and route a message that can never be handled to a poison path instead of retrying it.

## XState features used

- named guard (`isDuplicate`) driving an `always` transition
- `invoke` `onError` routing for signature and payload failures
- context as an idempotency set
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Four deliveries arrive: one is processed, one has a bad signature, one is a duplicate replay of the first, and one is a poison payload.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every delivery outcome to stdout.
