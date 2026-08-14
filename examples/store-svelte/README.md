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

`@xstate/store` stores are not actors, so the [Stately Inspector](https://stately.ai/registry/inspect) does not apply here. Log transitions instead:

```ts
cartStore.subscribe((snapshot) => console.log(snapshot.context));
```
