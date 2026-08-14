# store-counter-react

## What it teaches

The two ways to own state with `@xstate/store`: a module-level store created with `createStore(…)` that every component shares, and a per-component store created with `useStore(…)` that lives and dies with the component.

Use `createStore` when the state is app-wide (session, cart, theme) and any component may read or update it. Use `useStore` when each component instance needs its own copy — a list row, a form, a widget rendered many times — so the state resets when the component unmounts.

## XState features used

- `createStore` with `on` event handlers
- `useSelector` and `useStore` from `@xstate/store-react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

The inspector is not wired up in this example. To view the global store in the [Stately Inspector](https://stately.ai/registry/inspect), add `@statelyai/sdk` and call `globalStore.inspect(createInspector().inspect)` in `src/App.tsx`.
