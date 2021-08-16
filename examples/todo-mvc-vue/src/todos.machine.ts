import { spawn, ActorRef } from 'xstate';
import { nanoid } from 'nanoid';
import { createTodoMachine } from './todoItem.machine';
import { createModel } from 'xstate/lib/model';

const createTodo = (title: string) => {
  return {
    id: nanoid(),
    title,
    completed: false
  };
};

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  ref: ActorRef<any>;
}

const todosModel = createModel(
  {
    todo: '',
    todos: [] as Todo[],
    filter: 'all'
  },
  {
    events: {
      'NEWTODO.CHANGE': (value: string) => ({ value }),
      'NEWTODO.COMMIT': (value: string) => ({ value }),
      'TODO.COMMIT': (todo: Todo) => ({ todo }),
      'TODO.DELETE': (id: string) => ({ id }),
      SHOW: (filter: string) => ({ filter }),
      'MARK.completed': () => ({}),
      'MARK.active': () => ({}),
      CLEAR_COMPLETED: () => ({})
    }
  }
);

export const todosMachine = todosModel.createMachine({
  id: 'todos',
  context: todosModel.initialContext,
  initial: 'loading',
  states: {
    loading: {
      entry: todosModel.assign({
        todos: (context) => {
          // "Rehydrate" persisted todos
          return context.todos.map((todo) => ({
            ...todo,
            ref: spawn(createTodoMachine(todo))
          }));
        }
      }),
      always: 'ready'
    },
    ready: {}
  },
  on: {
    'NEWTODO.CHANGE': {
      actions: todosModel.assign({
        todo: (_, event) => event.value
      })
    },
    'NEWTODO.COMMIT': {
      actions: [
        todosModel.assign({
          todo: '', // clear todo
          todos: (context, event) => {
            console.log('value', event.value);
            const newTodo = createTodo(event.value.trim());
            return context.todos.concat({
              ...newTodo,
              ref: spawn(createTodoMachine(newTodo))
            });
          }
        }),
        'persist'
      ],
      cond: (_, event) => !!event.value.trim().length
    },
    'TODO.COMMIT': {
      actions: [
        todosModel.assign({
          todos: (context, event) =>
            context.todos.map((todo) => {
              return todo.id === event.todo.id
                ? { ...todo, ...event.todo, ref: todo.ref }
                : todo;
            })
        }),
        'persist'
      ]
    },
    'TODO.DELETE': {
      actions: [
        todosModel.assign({
          todos: (context, event) =>
            context.todos.filter((todo) => todo.id !== event.id)
        }),
        'persist'
      ]
    },
    SHOW: {
      actions: todosModel.assign({
        filter: (_, event) => event.filter
      })
    },
    'MARK.completed': {
      actions: (context) => {
        context.todos.forEach((todo) => todo.ref.send('SET_COMPLETED'));
      }
    },
    'MARK.active': {
      actions: (context) => {
        context.todos.forEach((todo) => todo.ref.send('SET_ACTIVE'));
      }
    },
    CLEAR_COMPLETED: {
      actions: todosModel.assign({
        todos: (context) => context.todos.filter((todo) => !todo.completed)
      })
    }
  }
});
