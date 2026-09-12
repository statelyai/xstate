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

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

The past stack is capped at 20 entries. Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
