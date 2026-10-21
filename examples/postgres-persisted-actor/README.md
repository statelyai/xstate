# postgres-persisted-actor

## What it teaches

Persisting an actor snapshot to a Postgres `jsonb` column after every transition and resuming from that row on the next run, so a workflow survives the process exiting.

## XState features used

- `setup()` with `schemas`
- Persistence: `actor.getPersistedSnapshot()` and the `snapshot` actor option
- Transition functions that return context updates, final state `output`
- `machine.events` plus `snapshot.can(...)` to list the events available now

## Run it

Start Postgres:

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name xstate-postgres postgres:16
```

Then:

```bash
pnpm install
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm start
```

`DATABASE_URL` defaults to `postgres://postgres:postgres@localhost:5432/postgres`, and `ACTOR_ID` (default `order-1`) selects the row. The `xstate_snapshots` table is created on startup. Type an event name (for example `ADD_ITEM`, then `CHECKOUT`) and press enter; stop the process and start it again to see the workflow resume where it left off.

Writes go through `TaskQueue` so that snapshots are stored in transition order. This mirrors [`../mongodb-persisted-state`](../mongodb-persisted-state); keep the two in sync when the persistence API changes.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

> Verified with `pnpm typecheck` only: no Postgres server was running when this example was written, so the SQL path has not been executed end to end.

> This example is a starting point, not production code. Credentials belong in the environment, and a real system would key snapshots by tenant and index `updated_at`.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
