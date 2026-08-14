# persisted-donut-maker

## What it teaches

Persisting an actor to a file after every transition and restoring it on the next run, so a long-running workflow survives the process exiting.

## XState features used

- `setup()`
- Persistence: `actor.getPersistedSnapshot()` and the `snapshot` actor option
- Nested, parallel and final states with `onDone`
- `machine.events` plus `snapshot.can(...)` to list the events available now

## Run it

```bash
pnpm install
pnpm start
```

Type an event name (for example `NEXT`) and press enter. The snapshot is written to `persisted-state.json` after every transition, so you can stop the process and pick up where you left off. Delete that file to start over.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

## Inspect it

Inspector: pending v6-compatible `@statelyai/inspect` (the current release peers on `xstate@^5`).
