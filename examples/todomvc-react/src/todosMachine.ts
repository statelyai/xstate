import { createMachine } from 'xstate';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export type TodosFilter = 'all' | 'active' | 'completed';

export const todosMachine = createMachine({
  types: {} as {
    context: {
      todo: string;
      todos: TodoItem[];
      filter: TodosFilter;
    };
    events:
      | { type: 'newTodo.change'; value: string }
      | { type: 'newTodo.commit'; value: string }
      | { type: 'todo.commit'; todo: TodoItem }
      | { type: 'todo.delete'; id: string }
      | { type: 'filter.change'; filter: TodosFilter }
      | { type: 'todo.mark'; id: string; mark: 'active' | 'completed' }
      | { type: 'todo.markAll'; mark: 'active' | 'completed' }
      | { type: 'todos.clearCompleted' };
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
    'newTodo.change': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          todo: (({ event }) => event.value)({ context: context, event: event })
        }
      };
    },
    'newTodo.commit': ({ context, event, guards, actions }, enq) => {
      if (!(({ event }) => event.value.trim().length > 0)({ context, event })) {
        return;
      }
      return {
        context: {
          ...context,
          todo: '',
          todos: (({ context, event }) => {
            const newTodo: TodoItem = {
              id: Math.random().toString(36).substring(7),
              title: event.value,
              completed: false
            };

            return [...context.todos, newTodo];
          })({ context: context, event: event })
        }
      };
    },
    'todo.commit': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          todos: (({ context, event }) => {
            const { todo: todoToUpdate } = event;

            if (!todoToUpdate.title.trim().length) {
              return context.todos.filter(
                (todo) => todo.id !== todoToUpdate.id
              );
            }

            return context.todos.map((todo) => {
              if (todo.id === todoToUpdate.id) {
                return todoToUpdate;
              }

              return todo;
            });
          })({ context: context, event: event })
        }
      };
    },
    'todo.delete': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          todos: (({ context, event }) => {
            const { id } = event;

            return context.todos.filter((todo) => todo.id !== id);
          })({ context: context, event: event })
        }
      };
    },
    'filter.change': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          filter: (({ event }) => event.filter)({
            context: context,
            event: event
          })
        }
      };
    },
    'todo.mark': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          todos: (({ context, event }) => {
            const { mark } = event;

            return context.todos.map((todo) => {
              if (todo.id === event.id) {
                return {
                  ...todo,
                  completed: mark === 'completed'
                };
              }

              return todo;
            });
          })({ context: context, event: event })
        }
      };
    },
    'todo.markAll': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          todos: (({ context, event }) => {
            const { mark } = event;

            return context.todos.map((todo) => {
              return {
                ...todo,
                completed: mark === 'completed'
              };
            });
          })({ context: context, event: event })
        }
      };
    },
    'todos.clearCompleted': ({ context, event, guards, actions }, enq) => {
      return {
        context: {
          ...context,
          todos: (({ context }) => {
            return context.todos.filter((todo) => !todo.completed);
          })({ context: context, event: event })
        }
      };
    }
  }
});
