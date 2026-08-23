# store-atoms

## What it teaches

Atoms in `@xstate/store`: writable atoms, computed atoms derived from other atoms, and a store selection that participates in the same dependency graph.

## XState features used

`createAtom` (writable and computed), `createStore`, `store.select`, `store.trigger`, `useAtom` and `useSelector` from `@xstate/store-react`.

## How it works

`createAtom(value)` returns a writable atom with `get()`, `set()`, and `subscribe()`. `createAtom(getter)` returns a read-only computed atom — every atom read inside the getter becomes a dependency, so it recomputes when any of them changes:

```ts
export const totalAtom = createAtom(
  () => (subtotalAtom.get() - discountAtom.get()) * (1 + taxRateAtom.get())
);
```

`store.select(selector)` returns an atom over the store's context, which is why `subtotalAtom` can be read from a computed atom exactly like `taxRateAtom`. Components subscribe with `useAtom(atom)` and only re-render when that atom's value changes.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/cart.ts` with `cartStore.inspect(inspector.inspect)`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live store. Store snapshots and the events that produced them are sent to Stately's hosted relay.

