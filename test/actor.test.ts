import { Machine, spawn, interpret } from '../src';
import { assign, send, sendParent } from '../src/actions';
import { Actor } from '../src/Actor';
import { assert } from 'chai';

describe('spawning actors', () => {
  const todoMachine = Machine({
    id: 'todo',
    initial: 'incomplete',
    states: {
      incomplete: {
        on: { SET_COMPLETE: 'complete' }
      },
      complete: {
        onEntry: sendParent({ type: 'TODO_COMPLETED' })
      }
    }
  });

  const context = {
    todoRefs: {} as Record<string, Actor>
  };

  type TodoEvent =
    | {
        type: 'ADD';
        id: string;
      }
    | {
        type: 'SET_COMPLETE';
        id: string;
      }
    | {
        type: 'TODO_COMPLETED';
      };

  const todosMachine = Machine<typeof context, any, TodoEvent>({
    id: 'todos',
    context,
    initial: 'active',
    states: {
      active: {
        on: {
          TODO_COMPLETED: 'success'
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
            [e.id]: spawn(todoMachine)
          })
        })
      },
      SET_COMPLETE: {
        actions: send('SET_COMPLETE', {
          to: (ctx, e) => {
            return ctx.todoRefs[e.id as string];
          }
        })
      }
    }
  });

  it('should invoke actors', done => {
    const service = interpret(todosMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send('ADD', { id: 42 });
    service.send('SET_COMPLETE', { id: 42 });
  });

  it('should not invoke actors spawned outside of a service', () => {
    assert.isUndefined(spawn(todoMachine));
  });
});
