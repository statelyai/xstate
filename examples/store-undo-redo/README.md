# store-undo-redo

## What it teaches

Adding undo/redo to a `@xstate/store` store with the `undoRedo` extension, using the snapshot strategy that keeps past and future snapshots.

## XState features used

`createStore`, `store.with(...)` extensions, `undoRedo` from `@xstate/store/undo`, `store.trigger`, `useSelector` from `@xstate/store-react`.

## How it works

`.with(undoRedo(...))` wraps the store logic and adds `undo` and `redo` event handlers:

```ts
export const drawingStore = createStore({
  context: { dots: [] as Dot[], strokes: 0 },
  on: {
    /* … */
  }
}).with(undoRedo({ strategy: 'snapshot', historyLimit: 50 }));
```

Two strategies are available. `'event'` (the default) records the events and replays them; `'snapshot'` records whole snapshots, so an undo is a restore rather than a replay, and it puts `past` and `future` arrays on the store snapshot. The demo reads those arrays to label and disable the buttons.

The snapshot type is not widened by `.with(undoRedo(...))`, so `past` and `future` are read through the small `historyOf` helper in `drawingStore.ts`.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/drawingStore.ts` with `drawingStore.inspect(inspector.inspect)`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live store. Store snapshots and the events that produced them are sent to Stately's hosted relay.

