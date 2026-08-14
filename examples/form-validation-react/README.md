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

This example does not bundle an inspector. To watch the actor live, add
[`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the
hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const [state, send] = useActor(formMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

The availability check is a mocked delayed promise; no network calls are made.
Built against the XState v6 alpha in this repo (`xstate: workspace:*`).
