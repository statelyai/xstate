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

`@xstate/store` stores are not actors, so the [Stately Inspector](https://stately.ai/registry/inspect) does not apply here. Log transitions instead:

```ts
todoStore.subscribe((snapshot) => console.log(snapshot.context));
```
