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

`@statelyai/inspect` is wired up in `src/TempConverter.vue`, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) in a new tab.
