# todomvc-webmcp-react

## What it teaches

How to expose an XState actor to browser agents with [`@xstate/webmcp`](../../packages/xstate-webmcp). The todos machine's events become [WebMCP](https://webmachinelearning.github.io/webmcp/) tools that an agent calls to manage the list, alongside the normal TodoMVC UI.

## XState features used

- `setup()` with Zod event schemas. Each schema's `.describe()` text becomes the tool description.
- `createWebMCP` from `@xstate/webmcp` with `output`, `overrides`, and a custom `add_todos` tool (`src/webmcp.ts`)
- `useSelector` from `@xstate/react` on a module-level actor. The actor and its tool registration live in `src/todos.ts`, outside React, so they are created once.

## Run it

```bash
pnpm install
pnpm dev
```

In a browser with WebMCP enabled, the tools register with `document.modelContext` and your browser agent can call them. In other browsers, the tools register with an in-page model context, and the panel below the app lists them and calls them the way an agent would.

The tools are `todo_add`, `todo_edit`, `todo_mark`, `todo_markAll`, `todo_delete`, `todos_clearCompleted`, `filter_change`, `get_state`, and `add_todos`. Tool names are the event types with `.` replaced by `_`.

```bash
pnpm test
```

runs `src/webmcp.test.ts`, which calls the tools through `createMockModelContext`.

## Inspect it

`@statelyai/sdk` is wired up in `src/todos.ts`, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Tool calls appear there as events. Machine definitions and snapshots are sent to Stately's hosted relay.

## Notes

Built against the XState v6 beta in this repo (`xstate: workspace:*`), not a published release. Zod 4 is a dependency because `@xstate/webmcp` converts event schemas to JSON Schema through [Standard JSON Schema](https://standardschema.dev/json-schema). `todomvc-app-css` and `todomvc-common` provide the standard TodoMVC markup styles, and `classnames` builds the conditional `className` values that markup expects.

This is an implementation of [TodoMVC](https://todomvc.com/).
