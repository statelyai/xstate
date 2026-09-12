# mongodb-credit-check-api

## What it teaches

Running a long-lived workflow behind an HTTP API, where every transition persists the actor snapshot to MongoDB so the workflow can be restored on the next request.

## XState features used

- `setup()` with schemas, named actors, actions and guards
- `createAsyncLogic` for the bureau and database calls
- Parallel states with `onDone` to wait for three credit bureaus
- Persistence: `actor.getPersistedSnapshot()` and the `snapshot` actor option

## Run it

Start MongoDB (any 6.x/7.x server works):

```bash
docker run --rm -d -p 27017:27017 --name xstate-mongo mongo:7
```

Then:

```bash
pnpm install
MONGODB_URI=mongodb://localhost:27017 pnpm start
```

`MONGODB_URI` defaults to `mongodb://localhost:27017`. The `creditCheck` database and its `machineStates`, `creditReports` and `creditProfiles` collections are created on first write.

The `start` script uses `vite-node` so that `xstate` resolves to this repo's source.

### Endpoints

```bash
# Create a workflow instance
curl -X POST http://localhost:4242/workflows

# Submit an application (replace :id with the returned workflowId)
curl -X POST http://localhost:4242/workflows/:id \
  -H 'Content-Type: application/json' \
  -d '{"type":"Submit","SSN":"123456789","firstName":"Gavin","lastName":"Bauman"}'

# Read the persisted snapshot
curl http://localhost:4242/workflows/:id
```

The bureau calls sleep for 1-10 seconds each, so poll the GET endpoint to watch the parallel regions finish.

This example is for learning, not production: there is no authentication, no error taxonomy, and credentials are logged.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
