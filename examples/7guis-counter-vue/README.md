# 7guis-counter-vue

## What it teaches

The [1st task of the 7 GUIs](https://eugenkiss.github.io/7guis/tasks#counter): a single event updates machine context, and a Vue component renders it.

## XState features used

- `setup()` with `schemas`
- Root-level transition function returning updated context
- `useMachine` from `@xstate/vue`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/inspect` is wired up in `src/Counter.vue`, so running the example opens the [Stately Inspector](https://stately.ai/registry/inspect) in a new tab.
