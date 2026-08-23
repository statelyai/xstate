# 7guis-circles-react

## What it teaches

Undo/redo of a whole model held in context, with a mode state that groups a continuous diameter drag into a single undo entry. This is [the 7GUIs circle drawer task](https://eugenkiss.github.io/7guis/tasks#circle), part of [the 7GUIs benchmark suite](https://eugenkiss.github.io/7guis/tasks).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events) and a standalone, args-first `guard`
- `past` / `future` undo stacks in context, the same pattern as [`undo-redo-react`](../undo-redo-react)
- An `adjusting` state that snapshots the model on entry, so the whole drag is one entry
- Root-level `on` handlers for `undo` / `redo` targeting `.idle`
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(circlesMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

The adjuster opens on right-click (the secondary action), matching the task spec. Selection picks the innermost circle containing the pointer.
