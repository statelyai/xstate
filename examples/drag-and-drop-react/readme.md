# drag-and-drop-react

## What it teaches

Pointer interaction as an explicit state machine: `idle` → `pressed` → `dragging` → `dropped` or `cancelled`. A press only becomes a drag once the pointer passes a distance threshold, and cancelling (Escape or `pointercancel`) returns to `idle` without reordering the list.

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events)
- Transition functions that return `undefined` to decline a transition — this is how v6 expresses a guard; there is no `guard:` key
- Transient `always` transitions to commit or discard the drag
- `useActor` from `@xstate/react`, with DOM pointer and keyboard events as the only inputs

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
