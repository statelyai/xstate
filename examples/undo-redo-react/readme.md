# undo-redo-react

## What it teaches

Undo/redo as `past`/`present`/`future` stacks in context, where rapid consecutive edits are grouped into a single undo entry by deferring the commit: each keystroke re-enters an `editing` state, restarting a delayed transition that closes the entry after a period of quiet.

## XState features used

- `setup()` with `schemas` and named `delays`
- Delayed transition (`after`) with a self-transition using `reenter: true` to restart the timer
- Transition functions returning `{ target, context }`, and returning nothing to no-op when a stack is empty
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

const [state, send] = useActor(editorMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

The past stack is capped at 20 entries. Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
