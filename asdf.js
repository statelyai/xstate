const {
  Machine,
  spawn,
  assign,
  interpret,
  send,
  actions
} = require('./lib/index');

const todoMachine = Machine({
  id: 'todo',
  initial: 'incomplete',
  states: {
    incomplete: {
      on: {
        SET_COMPLETE: 'complete'
      }
    },
    complete: {
      type: 'final'
    }
  }
});

const todosMachine = Machine({
  id: 'todos',
  initial: 'active',
  context: {
    refs: {},
    todos: {}
  },
  states: {
    active: {
      on: {
        ADD_TODO: {
          actions: assign({
            refs: (ctx, e) => ({
              [e.id]: spawn(todoMachine)
            })
          })
        },
        COMPLETE_TODO: {
          actions: send('SET_COMPLETE', { to: (_, e) => e.id })
        }
      },
      onUpdate: {
        actions: assign({
          todos: (ctx, e) => ({
            ...ctx.todos,
            [e.id]: e.state.value
          })
        })
      }
    }
  }
});

const s = interpret(todosMachine)
  .onTransition(state => console.log(JSON.stringify(state.context)))
  .start();

s.send('ADD_TODO', { id: 1 });
s.send('COMPLETE_TODO', { id: 1 });
