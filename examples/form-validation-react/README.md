# form-validation-react

## What it teaches

Per-field validation as state: a username field that moves through
pristine → debouncing → checking → available/taken, where typing again both
restarts the debounce and cancels the in-flight availability request.

## XState features used

- `setup()` with `schemas`, `actors`, and `delays`
- Parallel states — one region per field
- Delayed transitions (`after`) for the debounce
- `createAsyncLogic` with `signal` for cancelling a stale request
- External self-transition (`target: '.debouncing'`) to restart the timer

## Run it

```bash
pnpm install
pnpm dev
```

`ada`, `grace` and `alan` are taken; anything else is available. Type quickly
and only the last keystroke triggers a request.

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

The availability check is a mocked delayed promise; no network calls are made.
Built against the XState v6 alpha in this repo (`xstate: workspace:*`).
