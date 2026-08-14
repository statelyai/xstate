# trivia-game-example

## What it teaches

How to drive a whole app — data fetching, scoring, win/lose, and failure
recovery — from a single hierarchical machine, where every remote call is an
invoked actor with explicit `onDone` and `onError` transitions.

## XState features used

- `setup({ schemas, actors })` with `types<T>()` schemas
- `createAsyncLogic` actors for the three Rick & Morty API calls
- `invoke` with `onDone` / `onError`, including dedicated `loadFailed` error
  states with a `user.retry` transition
- Nested (hierarchical) states, `#id` targets, `always` (eventless) transitions
- Transition functions returning context patches
- `@xstate/react`'s `createActorContext`, `useSelector`, and `useActorRef`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

This example does not bundle an inspector. To add one:

```bash
pnpm add @statelyai/inspect
```

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

// then pass it as the second argument
const [state, send] = useActor(machine, { inspect: inspector.inspect });
```

See https://stately.ai/registry/inspect and https://stately.ai/docs/inspector.

## Notes

- Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a
  published release.
- **Network access required.** The game calls the third-party public
  [Rick & Morty API](https://rickandmortyapi.com) (`https://rickandmortyapi.com/api/character`)
  for every question. There is no offline or mocked mode. If a request fails,
  the machine enters a `loadFailed` state and the UI renders a retry button.
- Game rules: 3 lives, +10 points per correct answer, 100 points to win, one
  clue per question.

The complete machine is also viewable in the
[Stately editor](https://stately.ai/registry/editor/f64904b1-65f9-4946-aace-ddfc9fd05c29?machineId=aec325d6-2d51-4334-afc4-f2c02a67aa05).
