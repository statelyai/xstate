# 7guis-crud-react

## What it teaches

A machine that owns an entire list UI — entries, selection, filter, and draft fields — with standalone, args-first guards deciding whether create, update, and delete may run. This is [the 7GUIs CRUD task](https://eugenkiss.github.io/7guis/tasks#crud), part of [the 7GUIs benchmark suite](https://eugenkiss.github.io/7guis/tasks).

## XState features used

- `setup()` with `schemas` (`types<T>()` for context and events)
- Standalone `guards` (`hasSelection`, `isNamed`) called explicitly from transition functions
- Root-level `on` transition functions returning `{ context }`, or `undefined` to reject the event
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

The machine has no states — the whole task is context plus guards — which is the point: guards are the mechanism, not state topology.
