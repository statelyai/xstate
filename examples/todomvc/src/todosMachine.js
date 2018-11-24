import { Machine, actions } from 'xstate';
import uuid from 'uuid-v4';
const { assign, log } = actions;

const createTodo = (title, id) => {
  return {
    id: id || uuid(),
    title: title,
    completed: false
  };
};

export const todosMachine = Machine({
  id: 'todos',
  context: {
    todo: '', // new todo
    todos: []
  },
  initial: 'all',
  states: {
    all: {},
    active: {},
    completed: {}
  },
  on: {
    'NEWTODO.CHANGE': {
      actions: assign({
        todo: (ctx, e) => e.value
      })
    },
    'NEWTODO.COMMIT': {
      actions: [
        assign({
          todo: '', // clear todo
          todos: (ctx, e) => ctx.todos.concat(createTodo(e.value, e.id))
        }),
        'persist'
      ],
      cond: (ctx, e) => e.value.length
    },
    'TODO.COMMIT': {
      actions: [
        assign({
          todos: (ctx, e) => {
            return ctx.todos.map(todo =>
              todo.id === e.todo.id ? e.todo : todo
            );
          }
        }),
        'persist'
      ]
    },
    'TODO.DELETE': {
      actions: assign({
        todos: (ctx, e) => {
          return ctx.todos.filter(todo => todo.id !== e.id);
        }
      })
    },
    'SHOW.all': '.all',
    'SHOW.active': '.active',
    'SHOW.completed': '.completed',
    'MARK.completed': {
      actions: assign({
        todos: ctx => ctx.todos.map(todo => ({ ...todo, completed: true }))
      })
    },
    'MARK.active': {
      actions: assign({
        todos: ctx => ctx.todos.map(todo => ({ ...todo, completed: false }))
      })
    },
    CLEAR_COMPLETED: {
      actions: assign({
        todos: ctx => ctx.todos.filter(todo => !todo.completed)
      })
    }
  }
});
