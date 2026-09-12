import { setup, types } from 'xstate';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export type TodosFilter = 'all' | 'active' | 'completed';

export const todosMachine = setup({
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
  }
}).createMachine({
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
    'newTodo.change': ({ event }) => ({
      context: { todo: event.value }
    }),
    'newTodo.commit': ({ context, event }) => {
      if (!event.value.trim().length) {
        return;
      }

      const newTodo: TodoItem = {
        id: Math.random().toString(36).substring(7),
        title: event.value,
        completed: false
      };

      return {
        context: {
          todo: '',
          todos: [...context.todos, newTodo]
        }
      };
    },
    'todo.commit': ({ context, event }) => {
      const { todo: todoToUpdate } = event;

      // An empty title deletes the todo
      if (!todoToUpdate.title.trim().length) {
        return {
          context: {
            todos: context.todos.filter((todo) => todo.id !== todoToUpdate.id)
          }
        };
      }

      return {
        context: {
          todos: context.todos.map((todo) =>
            todo.id === todoToUpdate.id ? todoToUpdate : todo
          )
        }
      };
    },
    'todo.delete': ({ context, event }) => ({
      context: {
        todos: context.todos.filter((todo) => todo.id !== event.id)
      }
    }),
    'filter.change': ({ event }) => ({
      context: { filter: event.filter }
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
    'todos.clearCompleted': ({ context }) => ({
      context: {
        todos: context.todos.filter((todo) => !todo.completed)
      }
    })
  }
});
