import { createModel } from 'xstate/lib/model';
import { spawn, ActorRef, EventFrom, createMachine, assign } from 'xstate';
import { createTodoMachine } from './todo.machine';

import { nanoid } from 'nanoid';

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

type TodosEvents = EventFrom<typeof todosModel>[keyof EventFrom<
  typeof todosModel
>];

export const todosMachine = createMachine({
  id: 'todos',
  types: {} as {
    events:
      | { type: 'NEWTODO.CHANGE'; value: string }
      | { type: 'NEWTODO.COMMIT'; value: string }
      | { type: 'TODO.COMMIT'; value: string };
  },
  context: {
    todo: '',
    todos: [] as Todo[],
    filter: 'all'
  },
  on: {
    'NEWTODO.CHANGE': {
      actions: assign({
        todo: ({ event }) => event.value
      })
    },
    'NEWTODO.COMMIT': {
      actions: [
        assign({
          todo: '', // clear todo
          todos: ({ context, event }) => {
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
      guard: ({ event }) => !!event.value.trim().length
    },
    'TODO.COMMIT': {
      actions: [
        assign({
          todos: ({ context, event }) =>
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
        assign({
          todos: ({ context, event }) =>
            context.todos.filter((todo) => todo.id !== event.id)
        }),
        'persist'
      ]
    },
    SHOW: {
      actions: assign({
        filter: ({ event }) => event.filter
      })
    },
    'MARK.completed': {
      actions: ({ context }) => {
        context.todos.forEach((todo) =>
          todo.ref.send({ type: 'SET_COMPLETED' })
        );
      }
    },
    'MARK.active': {
      actions: ({ context }) => {
        context.todos.forEach((todo) => todo.ref.send({ type: 'SET_ACTIVE' }));
      }
    },
    CLEAR_COMPLETED: {
      actions: [
        assign({
          todos: ({ context }) =>
            context.todos.filter((todo) => !todo.completed)
        }),
        'persist'
      ]
    }
  }
});
