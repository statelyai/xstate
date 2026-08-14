# mongodb-persisted-state

## What it teaches

Persisting an actor snapshot to MongoDB after every transition and restoring it on the next run, so a workflow survives the process exiting.

## XState features used

- `setup()`
- Persistence: `actor.getPersistedSnapshot()` and the `snapshot` actor option
- Nested, parallel and final states with `onDone`
- `machine.events` plus `snapshot.can(...)` to list the events available now

## Run it

Start MongoDB:

```bash
docker run --rm -d -p 27017:27017 --name xstate-mongo mongo:7
```

Then:

```bash
pnpm install
MONGODB_URI=mongodb://localhost:27017 pnpm start
```

`MONGODB_URI` defaults to `mongodb://localhost:27017`. The `donut-maker` database and its `donuts` collection are created on the first write. Type an event name (for example `NEXT`) and press enter; stop the process and start it again to see the workflow resume.

The actor is bound to a single document, which it upserts. Writes go through `TaskQueue` so that snapshots are stored in transition order.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

> This example is a starting point, not production code. Among other things, URI credentials must be encoded — see [MongoDB's Node driver docs](https://www.mongodb.com/docs/drivers/node/current/fundamentals/authentication/mechanisms/).

`donutMachine.ts` is a copy of the machine in [`../persisted-donut-maker`](../persisted-donut-maker), so each example stays runnable on its own. Keep the two files in sync.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect` (the current release peers on `xstate@^5`).
