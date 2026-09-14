# counter

## What it teaches

Keeping state in machine context and updating it from transitions, without any finite states.

## XState features used

- `setup()` with context and event schemas
- Root-level (`on`) transitions
- Transition functions that return the next `context`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
