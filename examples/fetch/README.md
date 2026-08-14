# fetch

## What it teaches

Invoking an async actor and modelling its loading, success, and failure states — including an automatic retry.

## XState features used

- `setup()` with `actors`
- `createAsyncLogic()` with an `input` schema
- `invoke` with `input`, `onDone`, and `onError`
- Delayed transitions (`after`)

## Run it

```bash
pnpm install
pnpm dev
```

The example logs each snapshot to the console.

## Inspect it

`@statelyai/inspect` is wired up, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) with the live actor.
