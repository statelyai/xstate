import { setup, types } from 'xstate';
import { z } from 'zod';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

const todoFilter = z.enum(['all', 'active', 'completed']);
const mark = z.enum(['active', 'completed']);

export type TodosFilter = z.infer<typeof todoFilter>;

// Each event schema has a description: @xstate/webmcp uses it as the tool
// description that agents read.
export const todosMachine = setup({
  schemas: {
    context: types<{
      nextId: number;
      todos: TodoItem[];
      filter: TodosFilter;
    }>(),
    events: {
      'todo.add': z
        .object({ title: z.string().trim().min(1) })
        .describe('Add a new, active todo.'),
      'todo.edit': z
        .object({ id: z.string(), title: z.string() })
        .describe('Rename a todo. An empty title deletes the todo.'),
      'todo.mark': z
        .object({ id: z.string(), mark })
        .describe('Mark one todo as active or completed.'),
      'todo.markAll': z
        .object({ mark })
        .describe('Mark every todo as active or completed.'),
      'todo.delete': z.object({ id: z.string() }).describe('Delete one todo.'),
      'todos.clearCompleted': z
        .object({})
        .describe('Delete every completed todo.'),
      'filter.change': z
        .object({ filter: todoFilter })
        .describe('Show all, active, or completed todos.')
    }
  }
}).createMachine({
  id: 'todos',
  context: {
    nextId: 2,
    todos: [{ id: '1', title: 'Learn state machines', completed: false }],
    filter: 'all'
  },
  on: {
    'todo.add': ({ context, event }) => ({
      context: {
        nextId: context.nextId + 1,
        todos: [
          ...context.todos,
          { id: String(context.nextId), title: event.title, completed: false }
        ]
      }
    }),
    'todo.edit': ({ context, event }) => ({
      context: {
        todos: event.title.trim()
          ? context.todos.map((todo) =>
              todo.id === event.id
                ? { ...todo, title: event.title.trim() }
                : todo
            )
          : context.todos.filter((todo) => todo.id !== event.id)
      }
    }),
    'todo.mark': ({ context, event }) => ({
      context: {
        todos: context.todos.map((todo) =>
          todo.id === event.id
            ? { ...todo, completed: event.mark === 'completed' }
            : todo
        )
      }
    }),
    'todo.markAll': ({ context, event }) => ({
      context: {
        todos: context.todos.map((todo) => ({
          ...todo,
          completed: event.mark === 'completed'
        }))
      }
    }),
    'todo.delete': ({ context, event }) => ({
      context: {
        todos: context.todos.filter((todo) => todo.id !== event.id)
      }
    }),
    'todos.clearCompleted': ({ context }) => ({
      context: {
        todos: context.todos.filter((todo) => !todo.completed)
      }
    }),
    'filter.change': ({ event }) => ({
      context: { filter: event.filter }
    })
  }
});
