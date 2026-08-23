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

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
