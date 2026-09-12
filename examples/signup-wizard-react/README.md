# signup-wizard-react

## What it teaches

A multi-step signup wizard where each step is a state, and per-step validation
is a transition function that returns nothing when the step is invalid — so the
wizard cannot advance past a bad step.

## XState features used

- `setup()` with `schemas` and `actors`
- Transition functions that return `undefined` to block a transition (v6 has no
  `guard` key)
- Transition functions returning partial `context` updates
- `createAsyncLogic` for the mock signup request
- `invoke` with `onDone` / `onError`, plus a `submitFailed` retry state

## Run it

```bash
pnpm install
pnpm dev
```

Fill in the account step (a valid email and an 8-character password), then the
profile step, then review and submit. The mock signup service fails the first
attempt and succeeds on retry.

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

The signup request is mocked with a delayed promise; no network calls are made.
Built against the XState v6 alpha in this repo (`xstate: workspace:*`).
