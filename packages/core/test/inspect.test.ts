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

  it('can inspect communications between actors', async () => {
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

    expect(
      events.map((event) => {
        if (event.type === '@xstate.communication') {
          return {
            type: event.type,
            sourceId: event.sourceId,
            targetId: event.targetId,
            event: event.event.type
          };
        }
        if (event.type === '@xstate.registration') {
          return {
            type: event.type,
            sessionId: event.sessionId
          };
        }
        return {
          type: event.type,
          sessionId: event.sessionId,
          snapshot:
            typeof event.snapshot === 'object' && 'value' in event.snapshot
              ? { value: event.snapshot.value }
              : event.snapshot,
          event: event.event.type
        };
      })
    ).toMatchInlineSnapshot(`
      [
        {
          "sessionId": "x:0",
          "type": "@xstate.registration",
        },
        {
          "sessionId": "x:1",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:1",
          "snapshot": {
            "value": "start",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:0",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "load",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "loadChild",
          "sourceId": "x:0",
          "targetId": "x:1",
          "type": "@xstate.communication",
        },
        {
          "sessionId": "x:2",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:2",
          "snapshot": undefined,
          "type": "@xstate.transition",
        },
        {
          "event": "loadChild",
          "sessionId": "x:1",
          "snapshot": {
            "value": "loading",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "load",
          "sessionId": "x:0",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "$$xstate.resolve",
          "sourceId": "x:2",
          "targetId": "x:2",
          "type": "@xstate.communication",
        },
        {
          "event": "done.invoke.(machine).loading:invocation[0]",
          "sourceId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.communication",
        },
        {
          "event": "toParent",
          "sourceId": "x:1",
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "toParent",
          "sessionId": "x:0",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "done.invoke.child",
          "sourceId": "x:1",
          "targetId": "x:0",
          "type": "@xstate.communication",
        },
        {
          "event": "done.invoke.child",
          "sessionId": "x:0",
          "snapshot": {
            "value": "success",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "done.invoke.(machine).loading:invocation[0]",
          "sessionId": "x:1",
          "snapshot": {
            "value": "loaded",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "$$xstate.resolve",
          "sessionId": "x:2",
          "snapshot": 42,
          "type": "@xstate.transition",
        },
      ]
    `);
  });
});
