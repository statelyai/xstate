# infinite-scroll-react

## What it teaches

Pagination as a state machine: an `idle` → `loadingPage` cycle that appends each page to context, ends in a final `end` state when the mock data runs out, and retries the same page from an `error` state. A DOM `IntersectionObserver` is only an event source that sends `LOAD_MORE`.

## XState features used

- `setup()` with `schemas` and an `actors` map
- `createAsyncLogic` for the mocked, delayed page request
- `invoke` with `input`, `onDone`, and `onError` transition functions
- Final state (`type: 'final'`) to model "no more pages"
- `useActorRef` + `useSelector` from `@xstate/react`, with the observer wired up in an effect

## Run it

```bash
pnpm install
pnpm dev
```

Page 3 fails the first time it is requested, so the `error` state and `RETRY` are reachable without touching the network.

## Inspect it

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const feedRef = useActorRef(feedMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
