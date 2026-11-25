# @xstate/webmcp

Expose XState actors and `@xstate/store` stores as [WebMCP](https://webmachinelearning.github.io/webmcp/) tools. Each exposed event becomes a tool whose input is the event payload. Custom tools can send several events and wait for a result.

## Installation

```bash
npm install @xstate/webmcp
```

The package has no runtime dependencies. It works with any `xstate` actor or `@xstate/store` store.

## Quick start

<!-- createWebMCP API from src/webmcp.ts -->

```ts
import { createStore } from '@xstate/store';
import { createWebMCP } from '@xstate/webmcp';
import { z } from 'zod';

const todoStore = createStore({
  schemas: {
    events: {
      'todo.add': z
        .object({ title: z.string().min(1) })
        .describe('Add a todo item.'),
      'todo.remove': z
        .object({ id: z.number() })
        .describe('Remove a todo item by id.')
    }
  },
  context: { todos: [] as { id: number; title: string }[] },
  on: {
    'todo.add': (context, event) => ({
      todos: [...context.todos, { id: context.todos.length, title: event.title }]
    }),
    'todo.remove': (context, event) => ({
      todos: context.todos.filter((todo) => todo.id !== event.id)
    })
  }
});

const webMCP = createWebMCP(todoStore, { events: ['todo.*'] });
const registration = webMCP.register();

// Later, for example when the component unmounts:
registration.unregister();
```

This registers three tools with `document.modelContext`: `todo_add`, `todo_remove`, and a read-only `get_state` tool.

## Exposing events

The `events` option is required. It lists the events agents can send:

- An exact event type: `'todo.add'`
- A trailing wildcard: `'todo.*'` matches `todo` and every `todo.…` event
- `'*'` for every event that has a schema

Wildcards expand to one tool per event. They are never registered as tool names. Use `'*'` only when every event is safe for an agent to send.

Every exposed event needs an event schema in `schemas.events`. The schema validates tool input and becomes the tool's `inputSchema`.

- Schemas that implement [Standard JSON Schema](https://standardschema.dev/json-schema) (Zod 4, Valibot, ArkType) convert automatically. For other schemas, pass a `toJSONSchema` option.
- The tool description comes from the schema description. For machines, a transition `description` is used when the schema has none. An event with neither throws an error when you call `createWebMCP`.
- Input that fails the schema rejects the tool call with a `WebMCPInputError`, and no event is sent.

### Tool names

Event types stay as written in your machine or store. Tool names are derived from them by the `toolName` option, which defaults to `toToolName`. It replaces `.` and any other character outside `[a-zA-Z0-9_-]` with `_`, so `checkout.confirm` becomes the tool `checkout_confirm`. Model APIs that agents forward tools to commonly reject `.` in tool names.

Pass your own `toolName` to change the mapping for every event tool:

```ts
import { createWebMCP, toToolName } from '@xstate/webmcp';

createWebMCP(todoStore, {
  events: ['todo.*'],
  toolName: (eventType) => `send_${toToolName(eventType)}`
});
// Tools: send_todo_add, send_todo_remove, get_state
```

`createWebMCP` throws if two tools end up with the same name, for example when both `todo.add` and `todo_add` are exposed.

### Overrides

Use `overrides` to change the name, title, description, or annotations of an event tool:

```ts
createWebMCP(todoStore, {
  events: ['todo.*'],
  prefix: 'todos',
  overrides: {
    'todo.remove': {
      name: 'delete',
      annotations: { consequentialHint: true }
    }
  }
});
// Tools: todos_todo_add, todos_delete, todos_get_state
```

An override `name` replaces the `toolName` result and is used as written. `prefix` is prepended to every tool name, including the state tool and custom tools, as `${prefix}_${name}`. WebMCP allows tool names of 1 to 128 characters of ASCII letters, digits, `_`, `-`, or `.`.

## Tool results

Event tools return `output(snapshot)` after the event is processed. The `get_state` tool returns the same value without sending anything.

By default, `output` returns `{ status, state, output }` and leaves out `context`. Pass `output` to choose what agents can read:

```ts
createWebMCP(todoStore, {
  events: ['todo.*'],
  output: (snapshot) => ({ todos: snapshot.context.todos })
});
```

Results are serialized to JSON, so `output` must return JSON-serializable values.

Set `stateTool: false` to omit the `get_state` tool, or pass `{ name, title, description }` to configure it.

## Machines

For machine actors, event tools follow the current state. By default (`availability: 'state'`), a tool is registered only while an active state node has a transition for its event. When the state changes, the adapter registers and unregisters tools, and the browser fires a `toolchange` event. When the machine finishes, stops, or errors, every event tool is unregistered.

```ts
import { createActor, createMachine } from 'xstate';
import { createWebMCP } from '@xstate/webmcp';
import { z } from 'zod';

const checkoutMachine = createMachine({
  schemas: {
    events: {
      'cart.add': z
        .object({ sku: z.string() })
        .describe('Add an item to the cart.'),
      'checkout.start': z.object({}).describe('Start checkout.'),
      cancel: z.object({}).describe('Cancel checkout.')
    }
  },
  context: { items: [] as string[] },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        'cart.add': ({ context, event }) => ({
          context: { items: [...context.items, event.sku] }
        }),
        'checkout.start': ({ context }) =>
          context.items.length > 0 ? { target: 'checkout' } : undefined
      }
    },
    checkout: {
      on: { cancel: { target: 'shopping' } }
    }
  }
});

const actor = createActor(checkoutMachine).start();
const webMCP = createWebMCP(actor, { events: '*' });

webMCP.register();
// Registered: cart_add, checkout_start, get_state
// After checkout_start: cancel, get_state
```

Before an event tool sends its event, it checks `snapshot.can(event)` with the validated payload. If a guard rejects the event, the tool call rejects with an error that lists the tools the current state accepts.

Pass `availability: 'always'` to keep every event tool registered. The `snapshot.can(event)` check still runs.

## Custom tools

Use `tools` to define tools that send several events, run async logic, or wait for a state. The `tool` helper infers the input type from `input` and types `send`, `getSnapshot`, and `waitFor` from the actor or store:

```ts
createWebMCP(actor, {
  events: [],
  tools: ({ tool }) => ({
    quickCheckout: tool({
      description: 'Add the given items and start checkout.',
      input: z.object({ skus: z.array(z.string()).min(1) }),
      annotations: { consequentialHint: true },
      async execute({ skus }, { send, waitFor }) {
        for (const sku of skus) {
          send({ type: 'cart.add', sku });
        }
        send({ type: 'checkout.start' });
        const snapshot = await waitFor((s) => s.matches('checkout'));
        return { items: snapshot.context.items };
      }
    })
  })
});
```

The second argument of `execute` contains:

| Property      | Description                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `send`        | Sends an event to the actor or store.                                                                                                          |
| `getSnapshot` | Returns the current snapshot.                                                                                                                  |
| `waitFor`     | Resolves with the first snapshot that matches a predicate. Rejects if the target errors, finishes, or stops first, or after `timeout` ms. |
| `signal`      | An `AbortSignal` that aborts when the agent cancels the call. `waitFor` uses it by default.                                                  |
| `target`      | The actor or store.                                                                                                                            |

Custom tools are always registered, whatever the current state.

## Registration

`register()` registers the available tools and returns a registration:

```ts
const controller = new AbortController();
const registration = webMCP.register({ signal: controller.signal });

await registration.ready; // initial tools registered
registration.status; // 'registered' | 'unregistered' | 'unsupported'

controller.abort(); // or registration.unregister()
```

| Option         | Description                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `modelContext` | The model context to register with. Defaults to `document.modelContext`, then `navigator.modelContext`. |
| `signal`       | Unregisters every tool when aborted.                                                             |
| `exposedTo`    | Origins the tools are exposed to.                                                                |
| `onError`      | Called when a later registration fails, such as after a state change. Defaults to `reportError`. |

When no model context exists, `status` is `'unsupported'` and nothing is registered. `ready` rejects if any initial registration fails, for example because another script registered a tool with the same name.

## Using the tools without WebMCP

`webMCP.tools` lists every tool as plain objects with `name`, `description`, `inputSchema`, and `execute`. `webMCP.getAvailableTools()` lists the tools the current state accepts. You can pass these to other tool-calling APIs, such as an MCP server or an LLM SDK.

## Testing

`createMockModelContext()` returns an in-memory model context that follows the WebMCP registration rules:

```ts
import { createMockModelContext, createWebMCP } from '@xstate/webmcp';

const modelContext = createMockModelContext();
await createWebMCP(todoStore, { events: ['todo.*'] }).register({ modelContext })
  .ready;

modelContext.getToolNames(); // ['todo_add', 'todo_remove', 'get_state']
await modelContext.executeTool('todo_add', { title: 'Buy milk' });
```

`executeTool` serializes the result to JSON and parses it again, like a browser does.
