# friends-list-react

## What it teaches

Spawned child actors: a parent machine spawns one `friendMachine` actor per list item with `enq.spawn(...)`, keeps the actor refs in its context, and stops them with `enq.stop(...)` on removal. Each child owns its own editing/saving state.

## XState features used

- `setup()` with `schemas` (`types<T>()` for context, events, input, and tags)
- `enq.spawn(logic, { id, input })` and `enq.stop(actorRef)` in transition functions
- Child machine `context: ({ input }) => ...` and `tags`
- `createAsyncLogic` invoked as `saveUser`, with `onDone` returning `{ target, context }`
- `useActor` for the parent machine and `useSelector` for each child actor ref

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

This example does not bundle an inspector. To watch the actors live, add [`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(friendsMachine, { inspect: inspector.inspect });
```

Spawned children are inspected along with their parent. Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

Actor refs are stored in the parent's context (rather than looked up via `children`) because the list is dynamic and ordered.

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/main/examples/friends-list-react)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/friends-list-react)
