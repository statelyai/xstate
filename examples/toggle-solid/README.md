# toggle-solid

## What it teaches

The smallest possible `@xstate/solid` app: a two-state toggle read through `useMachine`, whose snapshot is a Solid store so the UI updates fine-grained without a virtual DOM.

## XState features used

- `setup()` with `schemas` and `types<T>()`
- Transition functions that update context (`toggle` increments a counter)
- `useMachine` from `@xstate/solid`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
