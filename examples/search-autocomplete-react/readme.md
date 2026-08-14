# search-autocomplete-react

## What it teaches

Debouncing and cancellation in one machine: keystrokes raise a delayed `SEARCH` event that a newer keystroke cancels, and leaving `searching` aborts the in-flight request's `signal` so a stale result can never land.

## XState features used

- `setup()` with `schemas`, `actors`
- `enq.raise(event, { id, delay })` + `enq.cancel(id)` for debouncing
- `invoke` of `createAsyncLogic` with `signal`-based cancellation, `onDone` / `onError`
- Machine-level `on` handlers shared by every state
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

const [state, send] = useActor(searchMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

The corpus is a hardcoded array and the "request" is a 600 ms `setTimeout` inside `createAsyncLogic`, so the example runs offline. Any query containing `err` rejects, which exercises the `error` state. Keyboard navigation (ArrowUp / ArrowDown / Enter / Escape) is a highlighted index in context, not DOM focus.

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
