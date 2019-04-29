import { Machine, spawn, interpret } from '../src';
import { doneInvoke, assign, send } from '../src/actions';

describe('spawning actors', () => {
  const todoMachine = Machine({
    id: 'todo',
    initial: 'incomplete',
    states: {
      incomplete: {
        on: { SET_COMPLETE: 'complete' }
      },
      complete: { type: 'final' }
    }
  });

  const todosMachine = Machine({
    id: 'todos',
    context: {
      todoRefs: {}
    },
    initial: 'active',
    states: {
      active: {
        on: {
          [doneInvoke('42')]: 'success'
        }
      },
      success: {
        type: 'final'
      }
    },
    on: {
      ADD: {
        actions: assign({
          todoRefs: (ctx, e) => ({
            ...ctx.todoRefs,
            [e.id]: spawn(todoMachine, e.id)
          })
        })
      },
      SET_COMPLETE: {
        actions: send('SET_COMPLETE', {
          to: (_, e) => e.id as string
        })
      }
    }
  });

  it('should invoke actors', done => {
    const service = interpret(todosMachine)
      .start()
      .onDone(() => {
        done();
      });

    service.send('ADD', { id: 42 });
    service.send('SET_COMPLETE', { id: 42 });
  });
});
