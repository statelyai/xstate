# store-vue

## What it teaches

Sharing one `@xstate/store` store across Vue components: two components subscribe to the same todo store through `useSelector`, each deriving what it needs instead of storing derived state in context.

## XState features used

- `createStore` from `@xstate/store`
- `useSelector` from `@xstate/store-vue`, which returns a readonly `Ref`
- Selectors as derived state (filtered list, remaining count)

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/todoStore.ts` with `todoStore.inspect(inspector.inspect)`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live store. Store snapshots and the events that produced them are sent to Stately's hosted relay.

