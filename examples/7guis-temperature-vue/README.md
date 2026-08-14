# 7guis-temperature-vue

## What it teaches

The [2nd task of the 7 GUIs](https://eugenkiss.github.io/7guis/tasks#temp): two inputs stay in sync because both derive from one machine context, and invalid input leaves the context unchanged.

## XState features used

- `setup()` with `schemas`
- Transition functions that reject invalid input by returning nothing
- `useMachine` from `@xstate/vue`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/TempConverter.vue`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
