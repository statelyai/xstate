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

`@statelyai/inspect` is wired up, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) with the live actor.
