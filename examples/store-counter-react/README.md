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

`@statelyai/sdk` is wired up in `src/App.tsx` with `globalStore.inspect(inspector.inspect)`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live store. Store snapshots and the events that produced them are sent to Stately's hosted relay.

