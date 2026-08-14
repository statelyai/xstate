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

Atoms and stores are not actors, so the [Stately Inspector](https://stately.ai/registry/inspect) does not show them. To inspect the store's events, pass an `inspect` observer to `createStore`; see the [inspection docs](https://stately.ai/docs/inspector).
