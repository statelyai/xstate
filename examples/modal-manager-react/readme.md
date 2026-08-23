# modal-manager-react

## What it teaches

A stack of dialogs held in machine context instead of scattered booleans: `open` pushes an entry, `close` (or Escape) pops only the topmost, and each entry records the DOM id of the element that had focus so focus can be restored as the stack unwinds.

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events)
- Machine-level `on` transition functions returning `{ context }`
- Returning nothing from a transition function to no-op when the stack is empty
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

The machine owns the stack and the focus-return target; moving focus is left to the view, where the DOM is available. Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
