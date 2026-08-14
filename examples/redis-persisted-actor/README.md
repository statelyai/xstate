# redis-persisted-actor

## What it teaches

Persisting an actor snapshot to Redis with `SET`/`GET` after every transition, resuming from the key on the next run, and letting abandoned workflows expire with a TTL.

## XState features used

- `setup()` with `schemas`
- Persistence: `actor.getPersistedSnapshot()` and the `snapshot` actor option
- Transition functions that return context updates, final state `output`
- `machine.events` plus `snapshot.can(...)` to list the events available now

## Run it

Start Redis:

```bash
docker run --rm -d -p 6379:6379 --name xstate-redis redis:7
```

Then:

```bash
pnpm install
REDIS_URL=redis://localhost:6379 pnpm start
```

`REDIS_URL` defaults to `redis://localhost:6379`, and `ACTOR_ID` (default `order-1`) selects the key `xstate:snapshot:<id>`. Type an event name (for example `ADD_ITEM`, then `CHECKOUT`) and press enter; stop the process and start it again to see the workflow resume.

Every write sets a 24-hour TTL, so a workflow nobody finishes disappears instead of accumulating. The key is deleted when the machine reaches a final state. A workflow that must never be lost belongs in a durable store — see [`../postgres-persisted-actor`](../postgres-persisted-actor).

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

> Verified with `pnpm typecheck` only: no Redis server was running when this example was written, so the Redis path has not been executed end to end.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect`. Until then the example prints the current state and the events you can send next.
