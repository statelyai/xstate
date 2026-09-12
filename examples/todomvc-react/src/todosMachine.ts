import { types, createMachine } from 'xstate';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export type TodosFilter = 'all' | 'active' | 'completed';

export const todosMachine = createMachine({
  schemas: {
    context: types<{
      todo: string;
      todos: TodoItem[];
      filter: TodosFilter;
    }>(),
    events: {
      'newTodo.change': types<{ value: string }>(),
      'newTodo.commit': types<{ value: string }>(),
      'todo.commit': types<{ todo: TodoItem }>(),
      'todo.delete': types<{ id: string }>(),
      'filter.change': types<{ filter: TodosFilter }>(),
      'todo.mark': types<{ id: string; mark: 'active' | 'completed' }>(),
      'todo.markAll': types<{ mark: 'active' | 'completed' }>(),
      'todos.clearCompleted': types<{}>()
    }
  },
  id: 'todos',
  context: {
    todo: '',
    todos: [
      {
        id: '1',
        title: 'Learn state machines',
        completed: false
      }
    ],
    filter: 'all'
  },
  on: {
    'newTodo.change': ({ context, event }) => ({
      context: { ...context, todo: event.value }
    }),
    'newTodo.commit': ({ context, event }) => {
      if (!event.value.trim()) return;
      return {
        context: {
          ...context,
          todo: '',
          todos: [
            ...context.todos,
            { id: crypto.randomUUID(), title: event.value, completed: false }
          ]
        }
      };
    },
    'todo.commit': ({ context, event }) => ({
      context: {
        ...context,
        todos: event.todo.title.trim()
          ? context.todos.map((todo) =>
              todo.id === event.todo.id ? event.todo : todo
            )
          : context.todos.filter((todo) => todo.id !== event.todo.id)
      }
    }),
    'todo.delete': ({ context, event }) => ({
      context: {
        ...context,
        todos: context.todos.filter((todo) => todo.id !== event.id)
      }
    }),
    'filter.change': ({ context, event }) => ({
      context: { ...context, filter: event.filter }
    }),
    'todo.mark': ({ context, event }) => ({
      context: {
        ...context,
        todos: context.todos.map((todo) =>
          todo.id === event.id
            ? { ...todo, completed: event.mark === 'completed' }
            : todo
        )
      }
    }),
    'todo.markAll': ({ context, event }) => ({
      context: {
        ...context,
        todos: context.todos.map((todo) => ({
          ...todo,
          completed: event.mark === 'completed'
        }))
      }
    }),
    'todos.clearCompleted': ({ context }) => ({
      context: {
        ...context,
        todos: context.todos.filter((todo) => !todo.completed)
      }
    })
  }
});
