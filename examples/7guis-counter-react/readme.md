# 7guis-counter-react

## What it teaches

The smallest possible machine with context: a single event whose transition function returns updated context. This is [the 7GUIs counter task](https://eugenkiss.github.io/7guis/tasks#counter), part of [the 7GUIs benchmark suite](https://eugenkiss.github.io/7guis/tasks).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events)
- Machine-level `on` transition function returning `{ context }`
- `useActor` from `@xstate/react`

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.
