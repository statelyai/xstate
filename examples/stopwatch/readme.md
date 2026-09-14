# stopwatch

## What it teaches

Driving state from a long-running interval actor that is only alive while the machine is in a particular state.

## XState features used

- `setup()` with `actors`
- `createCallbackLogic()` sending events back to the parent
- `invoke` scoped to a state
- Root-level transition (`reset`) targeting a state (`.stopped`)

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
