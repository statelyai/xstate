import { createWebMCP } from '@xstate/webmcp';
import type { Actor } from 'xstate';
import { z } from 'zod';
import type { todosMachine } from './todosMachine';

/**
 * Exposes the todos actor to browser agents. Every event becomes a tool
 * (`todo.add` becomes `todo_add`), plus a read-only `get_state` tool and one
 * custom tool that adds several todos in one call.
 */
export function createTodosWebMCP(actor: Actor<typeof todosMachine>) {
  return createWebMCP(actor, {
    events: '*',
    overrides: {
      'todo.delete': { annotations: { consequentialHint: true } },
      'todos.clearCompleted': { annotations: { consequentialHint: true } }
    },
    // Agents read the todo list and filter, not internal fields like nextId.
    output: (snapshot) => ({
      filter: snapshot.context.filter,
      todos: snapshot.context.todos
    }),
    tools: ({ tool }) => ({
      add_todos: tool({
        description: 'Add several active todos at once.',
        input: z.object({ titles: z.array(z.string().trim().min(1)).min(1) }),
        execute({ titles }, { send, getSnapshot }) {
          for (const title of titles) {
            send({ type: 'todo.add', title });
          }
          return { todos: getSnapshot().context.todos };
        }
      })
    })
  });
}
