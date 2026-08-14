# tiles

## What it teaches

A sliding tile puzzle: hierarchical states model the select/move interaction, and named guards decide when a move is legal and when the puzzle is solved.

## XState features used

- `setup()` with context, event schemas, and named `guards`
- Nested (compound) states and `#id` targets
- Eventless transitions (`always`) to detect the win condition
- Disabling an event in a substate (`shuffle: undefined`)
- `useMachine()` from `@xstate/react` and `snapshot.can()`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/inspect` is wired up, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) with the live actor.
