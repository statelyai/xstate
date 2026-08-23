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

This example does not bundle an inspector. To watch the actor live, add [`@statelyai/sdk`](https://stately.ai/docs/inspector) and pass it to the hook:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const [state, send] = useActor(crudMachine, { inspect: inspector.inspect });
```

Then open https://stately.ai/registry/inspect.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

The machine has no states — the whole task is context plus guards — which is the point: guards are the mechanism, not state topology.
