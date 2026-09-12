# store-svelte

## What it teaches

Sharing one `@xstate/store` store across Svelte components: three components read the same cart through `useSelector`, each with its own selector, and send events to it directly.

## XState features used

- `createStore` from `@xstate/store`
- `useSelector` from `@xstate/store-svelte`, which returns a Svelte readable store (read with `$count`, `$items`)
- Derived values computed in selectors instead of stored in context

## Run it

```bash
pnpm install
pnpm dev
```

Type-check the Svelte components with `pnpm check`.

## Inspect it

`@statelyai/sdk` is wired up in `src/cartStore.ts` with `cartStore.inspect(inspector.inspect)`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live store. Store snapshots and the events that produced them are sent to Stately's hosted relay.

