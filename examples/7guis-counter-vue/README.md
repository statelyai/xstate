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

`@statelyai/sdk` is wired up in `src/Counter.vue`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
