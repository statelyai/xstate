import {
  InspectionEvent,
  createMachine,
  fromPromise,
  interpret,
  sendParent,
  sendTo,
  waitFor
} from '../src';

describe('inspect', () => {
  it('the .inspect option can observe inspection events', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const events: InspectionEvent[] = [];

    const actor = interpret(machine, {
      inspect: {
        next(event) {
          events.push(event);
        }
      }
    });
    actor.start();
    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    expect(events).toEqual([
      expect.objectContaining({
        type: '@xstate.registration'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'xstate.init' },
        snapshot: expect.objectContaining({
          value: 'a'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'NEXT' },
        snapshot: expect.objectContaining({
          value: 'b'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'NEXT' },
        snapshot: expect.objectContaining({
          value: 'c'
        })
      })
    ]);
  });

  it.only('can inspect communications between actors', async () => {
    // expect.assertions(1);
    const parentMachine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {},
        success: {}
      },
      invoke: {
        src: createMachine({
          initial: 'start',
          states: {
            start: {
              on: {
                loadChild: 'loading'
              }
            },
            loading: {
              invoke: {
                src: fromPromise(() => {
                  return Promise.resolve(42);
                }),
                onDone: {
                  target: 'loaded',
                  actions: sendParent({ type: 'toParent' })
                }
              }
            },
            loaded: {
              type: 'final'
            }
          }
        }),
        id: 'child',
        onDone: {
          target: '.success',
          actions: () => {
            events;
          }
        }
      },
      on: {
        load: {
          actions: sendTo('child', { type: 'loadChild' })
        }
      }
    });

    const events: InspectionEvent[] = [];

    const actor = interpret(parentMachine, {
      inspect: {
        next: (event) => {
          events.push(event);
        }
      }
    });

    actor.start();
    actor.send({ type: 'load' });

    await waitFor(actor, (state) => state.value === 'success');

    expect(events).toEqual([
      expect.objectContaining({
        type: '@xstate.registration'
      }),
      expect.objectContaining({
        type: '@xstate.registration'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'xstate.init' }
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'xstate.init' }
      }),
      expect.objectContaining({
        type: '@xstate.communication',
        event: { type: 'loadChild' },
        sourceId: 'x:0',
        targetId: 'x:1'
      }),
      expect.objectContaining({
        type: '@xstate.registration'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'xstate.init' },
        sessionId: 'x:2'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'loadChild' },
        sessionId: 'x:1'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        event: { type: 'load' },
        sessionId: 'x:0'
      }),
      expect.objectContaining({
        type: '@xstate.communication',
        event: { type: 'toParent' },
        sourceId: 'x:1',
        targetId: 'x:0'
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        sessionId: 'x:0',
        snapshot: expect.objectContaining({
          value: 'waiting'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        sessionId: 'x:0',
        snapshot: expect.objectContaining({
          value: 'success'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        sessionId: 'x:1',
        snapshot: expect.objectContaining({
          value: 'loaded'
        })
      }),
      expect.objectContaining({
        type: '@xstate.transition',
        sessionId: 'x:2',
        snapshot: 42
      })
    ]);
  });
});
