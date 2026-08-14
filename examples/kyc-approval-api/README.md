# kyc-approval-api

## What it teaches

Driving one long-lived review workflow per applicant from an Express 5 HTTP API: automated checks run in parallel, then the machine parks in `manualReview` until a reviewer calls an endpoint.

## XState features used

- `setup()` with `schemas`, `actors`
- parallel states with `onDone` for the two automated checks
- `invoke` with `createAsyncLogic`
- persistence: `actor.getPersistedSnapshot()` written on every transition
- final state `output`

## Run it

```bash
pnpm install
pnpm start
```

`pnpm start` boots the API on an ephemeral port and walks a full flow with `fetch`: submit, poll while the checks run, a premature approval that is rejected with `409`, request-info / provide-info, approve, and a second applicant with a sanctions hit that gets rejected.

To drive it by hand:

```bash
pnpm serve # listens on http://localhost:4243
curl -X POST localhost:4243/applicants -H 'content-type: application/json' -d '{"name":"Ada Lovelace","country":"GB"}'
curl localhost:4243/applicants/kyc-1
curl -X POST localhost:4243/applicants/kyc-1/approve -H 'content-type: application/json' -d '{"reviewer":"sam"}'
```

Endpoints: `POST /applicants`, `GET /applicants/:id`, and `POST /applicants/:id/{approve,reject,request-info,provide-info}`.

Snapshots are kept in a `Map`, so restarting the process loses them. Swap the map for a database — see [`../mongodb-persisted-state`](../mongodb-persisted-state) — to make it durable.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect`. Until then each request logs its resulting state.
