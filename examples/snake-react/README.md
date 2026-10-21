# snake-react

## What it teaches

A game loop driven by a machine: an invoked callback actor ticks on an interval, and an eventless (`always`) transition resolves eating an apple and colliding with the wall or the snake's own tail.

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events) and `actors`
- `createCallbackLogic` for the interval that sends `TICK`
- `invoke` scoped to the `Moving` state, so the loop stops on game over
- `always` (eventless transition) for scoring and collision detection
- Transition functions returning `{ target, context }` patches
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

An arrow key re-enters the `Moving` state, which restarts the tick actor and moves the snake immediately — so steering feels responsive instead of waiting for the next tick.

Adapted from https://github.com/josmithua/xsnake

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/main/examples/snake-react)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/snake-react)
