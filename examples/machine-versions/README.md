# machine-versions

## What it teaches

How to restore data written by a machine version that no longer exists as code: describe the old version with a schema, migrate its snapshots and adapt its event history with `machineVersions()`.

## XState features used

- `machineVersions()` with a `MachineVersionDescriptor` (`{ id, version, snapshotSchema, eventSchema }`) alongside the live machine
- `migrateSnapshot()` with an exact-version migration, and the identity it stamps
- `adaptEvents()` rewriting a whole v1 event history into v2 events
- machine `version`, Zod schemas as Standard Schemas for `schemas.context` and `schemas.events`
- restoring the migrated snapshot with `createActor(machine, { snapshot })`

## Run it

```bash
pnpm install
pnpm start
```

Version 1 of the checkout stored whole dollars and only exists as a schema. Version 2 stores cents and is the machine that runs. The demo migrates a stored v1 snapshot into v2 and keeps running it, shows the v1 schema rejecting corrupt historical data, folds a three-event v1 history into one v2 event, and shows that a schema-only version cannot be a migration target.

Two things worth knowing:

- A `snapshotSchema` describes the whole persisted contract, not just context. The migration must return a snapshot the target machine can validate, including `output` and `error`.
- Version 2 uses `createMachine` rather than `setup().createMachine()`. A `version` declared through `setup()` currently widens to `string`, and `machineVersions` matches migrations and adapters against the literal version type, so the callbacks lose their typing.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
