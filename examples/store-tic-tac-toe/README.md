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

`@statelyai/sdk` is wired up in `src/store.ts` with `gameStore.inspect(inspector.inspect)`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live store. Store snapshots and the events that produced them are sent to Stately's hosted relay.

