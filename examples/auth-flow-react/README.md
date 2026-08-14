# auth-flow-react

## What it teaches

A full authentication lifecycle as one machine: sign-in, a silent token refresh
cycle driven by a delayed transition, session expiry, and re-authentication.

## XState features used

- `setup()` with `schemas`, `actors`, and `delays`
- `createAsyncLogic` for the mock sign-in and token-refresh calls
- `invoke` with `onDone` / `onError` transition functions
- Nested states (`authenticated.idle` / `authenticated.refreshing`)
- Delayed transitions (`after`) for the refresh interval

## Run it

```bash
pnpm install
pnpm dev
```

Sign in with `ada@example.com` / `lovelace`. Any other password takes the
bad-credentials path. Once signed in, the token silently refreshes every four
seconds; press **Simulate expiry** to jump to the expired-session state.

## Inspect it

This example does not bundle an inspector. To watch the actor live, add
[`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the
hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(authMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

The backend is mocked with delayed promises; no network calls are made. Built
against the XState v6 alpha in this repo (`xstate: workspace:*`).
