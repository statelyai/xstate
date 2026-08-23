# auth-flow-vue

## What it teaches

An authentication flow in Vue: sign in through an async actor, keep the session alive with a delayed silent token refresh, and fall into a `sessionExpired` state when the refresh is rejected. Same machine as [`auth-flow-react`](../auth-flow-react), driven with `@xstate/vue`.

## XState features used

- `setup()` with `schemas`, `actors`, and `delays`
- `createAsyncLogic` actors invoked with `onDone` / `onError`
- Nested states (`authenticated.idle` / `authenticated.refreshing`)
- Delayed transitions (`after`) for the refresh interval
- `useActor` from `@xstate/vue` (returns a `snapshot` ref)

## Run it

```bash
pnpm install
pnpm dev
```

Sign in with `ada@example.com` / `lovelace`. Any other password fails.

## Inspect it

`@statelyai/sdk` is wired up in `src/Auth.vue`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
