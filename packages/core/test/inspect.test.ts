import {
  InspectionEvent,
  createActor,
  createMachine,
  fromPromise,
  interpret,
  sendParent,
  sendTo,
  waitFor
} from '../src';

function simplifyEvent(inspectionEvent: InspectionEvent) {
  if (inspectionEvent.type === '@xstate.event') {
    return {
      type: inspectionEvent.type,
      sourceId: inspectionEvent.sourceId,
      targetId: inspectionEvent.targetId,
      event: inspectionEvent.event.type
    };
  }
  if (inspectionEvent.type === '@xstate.actor') {
    return {
      type: inspectionEvent.type,
      sessionId: inspectionEvent.sessionId
    };
  }

  if (inspectionEvent.type === '@xstate.snapshot') {
    return {
      type: inspectionEvent.type,
      sessionId: inspectionEvent.sessionId,
      snapshot:
        typeof inspectionEvent.snapshot === 'object' &&
        'value' in inspectionEvent.snapshot
          ? { value: inspectionEvent.snapshot.value }
          : inspectionEvent.snapshot,
      event: inspectionEvent.event.type
    };
  }
}

describe('inspect', () => {
  it('the .inspect option can observe inspection events', async () => {
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
          // push events to websocket server
          // server.clients.forEach((client) => {
          //   client.send(JSON.stringify(event));
          // });
        }
      }
    });
    actor.start();

    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    expect(events.map(simplifyEvent)).toMatchInlineSnapshot(`
      [
        {
          "sessionId": "x:0",
          "type": "@xstate.actor",
        },
        {
          "event": "xstate.init",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:0",
          "snapshot": {
            "value": "a",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "NEXT",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "event": "NEXT",
          "sessionId": "x:0",
          "snapshot": {
            "value": "b",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "NEXT",
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "event": "NEXT",
          "sessionId": "x:0",
          "snapshot": {
            "value": "c",
          },
          "type": "@xstate.snapshot",
        },
      ]
    `);
  });

  it('can inspect communications between actors', async () => {
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

          // push events to websocket server
          // server.clients.forEach((client) => {
          //   client.send(JSON.stringify(event));
          // });
        }
      }
    });

    actor.start();
    actor.send({ type: 'load' });

    await waitFor(actor, (state) => state.value === 'success');

    expect(events.map(simplifyEvent)).toMatchInlineSnapshot(`
      [
        {
          "sessionId": "x:1",
          "type": "@xstate.actor",
        },
        {
          "sessionId": "x:2",
          "type": "@xstate.actor",
        },
        {
          "event": "xstate.init",
          "sourceId": undefined,
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sourceId": "x:1",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:2",
          "snapshot": {
            "value": "start",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "load",
          "sourceId": undefined,
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": "loadChild",
          "sourceId": "x:1",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "sessionId": "x:3",
          "type": "@xstate.actor",
        },
        {
          "event": "xstate.init",
          "sourceId": "x:2",
          "targetId": "x:3",
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:3",
          "snapshot": undefined,
          "type": "@xstate.snapshot",
        },
        {
          "event": "loadChild",
          "sessionId": "x:2",
          "snapshot": {
            "value": "loading",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "load",
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "$$xstate.resolve",
          "sourceId": "x:3",
          "targetId": "x:3",
          "type": "@xstate.event",
        },
        {
          "event": "xstate.done.actor.(machine).loading:invocation[0]",
          "sourceId": "x:3",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "event": "toParent",
          "sourceId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": "toParent",
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "xstate.done.actor.child",
          "sourceId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": "xstate.done.actor.child",
          "sessionId": "x:1",
          "snapshot": {
            "value": "success",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "xstate.done.actor.(machine).loading:invocation[0]",
          "sessionId": "x:2",
          "snapshot": {
            "value": "loaded",
          },
          "type": "@xstate.snapshot",
        },
        {
          "event": "$$xstate.resolve",
          "sessionId": "x:3",
          "snapshot": 42,
          "type": "@xstate.snapshot",
        },
      ]
    `);
  });
});
