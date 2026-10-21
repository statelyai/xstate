# toggle

## What it teaches

The smallest possible state machine: two states and one event that flips between them.

## XState features used

- `setup()` with event schemas
- Finite states and transitions
- `createActor()` and snapshot subscriptions

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
