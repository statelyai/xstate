# store-tic-tac-toe

## What it teaches

Modeling game rules as `@xstate/store` event handlers: each move is an event, and the winner is derived from the store's context.

## XState features used

- `createStore` with `on` event handlers
- `useSelector` from `@xstate/store-react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

The inspector is not wired up in this example. To view the store in the [Stately Inspector](https://stately.ai/registry/inspect), add `@statelyai/sdk` and call `store.inspect(createInspector().inspect)` in `src/store.ts`.
