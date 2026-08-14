# tic-tac-toe-react

## What it teaches

Eventless (`always`) transitions: after every move, the machine re-checks the board and moves itself to a game-over state without waiting for another event.

## XState features used

- `setup()` with `schemas` (`types<T>()` for context, events, and tags)
- Named `guards` in `setup()`, called from transition functions via `guards.*`
- `always` transitions for win/draw detection
- Nested states with `tags`, and `entry` returning updated context
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

const [state, send] = useActor(ticTacToeMachine, {
  inspect: inspector.inspect
});
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

`PLAY` flips the current player as part of the move, so the `gameOver.winner` state's `entry` records the *previous* player as the winner.

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/main/examples/tic-tac-toe-react)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/tic-tac-toe-react)
