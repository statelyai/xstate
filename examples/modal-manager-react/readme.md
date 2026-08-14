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

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const [state, send] = useActor(modalMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

The machine owns the stack and the focus-return target; moving focus is left to the view, where the DOM is available. Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
