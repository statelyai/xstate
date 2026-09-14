# timer

## What it teaches

A countdown timer: an interval actor decrements the remaining time, and guarded transitions decide when the timer may start or must stop.

## XState features used

- `setup()` with context, event schemas, and `actors`
- `createCallbackLogic()` for the one-second tick
- Guarded transitions (transition functions that return nothing to block)
- Eventless transitions (`always`)
- `useMachine()` from `@xstate/react` and `snapshot.can()`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
