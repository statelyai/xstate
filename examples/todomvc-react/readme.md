# todomvc-react

## What it teaches

Two levels of actors: one machine owns the todo list, and every todo row runs its own small machine for the read/edit lifecycle. The list machine's snapshot is persisted to `localStorage` and restored on load.

## XState features used

- `setup()` with `schemas` (`types<T>()` for context, events, and input)
- Transition functions returning `{ target, context }` context patches
- `createActorContext` from `@xstate/react` to share the list actor
- `useActorRef` + `useSelector` for the per-todo actors
- `getPersistedSnapshot()` and the `snapshot` actor option for persistence

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up in `src/App.tsx`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 alpha in this repo (`xstate: workspace:*`), not a published release.

Todos are persisted to `localStorage` under the `todos` key. Clear that key (or run in a private window) to start from the default list.

This is an implementation of [TodoMVC](https://todomvc.com/).

[Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/main/examples/todomvc-react)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/todomvc-react)
