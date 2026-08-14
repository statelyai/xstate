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

`@statelyai/inspect` is wired up, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) with the live actor.
