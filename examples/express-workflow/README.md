# express-workflow

## What it teaches

Running a state machine as a backend workflow: each HTTP request restores an actor from a persisted snapshot, sends it one event, and persists the next snapshot.

## XState features used

- `setup()` with schemas
- Persistence: `actor.getPersistedSnapshot()` and the `snapshot` actor option
- Transition functions that return the next context

## Run it

```bash
pnpm install
pnpm start
```

The server listens on http://localhost:4242. The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

### Endpoints

```bash
# Create a workflow instance
curl -X POST http://localhost:4242/workflows

# Send an event to it (replace :id with the returned workflowId)
curl -X POST http://localhost:4242/workflows/:id \
  -H 'Content-Type: application/json' \
  -d '{"type":"TIMER"}'

# Read its persisted snapshot
curl http://localhost:4242/workflows/:id
```

Snapshots are kept in memory, so they are lost when the server restarts. Swap the `Map` for a database to make workflows durable.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
