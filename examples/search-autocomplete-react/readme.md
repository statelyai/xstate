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

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

The corpus is a hardcoded array and the "request" is a 600 ms `setTimeout` inside `createAsyncLogic`, so the example runs offline. Any query containing `err` rejects, which exercises the `error` state. Keyboard navigation (ArrowUp / ArrowDown / Enter / Escape) is a highlighted index in context, not DOM focus.

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
