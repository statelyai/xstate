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
  if (inspectionEvent.type === '@xstate.communication') {
    return {
      type: inspectionEvent.type,
      sourceId: inspectionEvent.sourceId,
      targetId: inspectionEvent.targetId,
      event: inspectionEvent.event.type
    };
  }
  if (inspectionEvent.type === '@xstate.registration') {
    return {
      type: inspectionEvent.type,
      sessionId: inspectionEvent.sessionId
    };
  }
  if (inspectionEvent.type === '@xstate.action') {
    return {
      type: inspectionEvent.type,
      data: inspectionEvent.data
    };
  }
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
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:0",
          "snapshot": {
            "value": "a",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "NEXT",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "NEXT",
          "sessionId": "x:0",
          "snapshot": {
            "value": "b",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "NEXT",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "NEXT",
          "sessionId": "x:0",
          "snapshot": {
            "value": "c",
          },
          "type": "@xstate.transition",
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
          "type": "@xstate.registration",
        },
        {
          "sessionId": "x:2",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:2",
          "snapshot": {
            "value": "start",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "load",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "loadChild",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "sessionId": "x:3",
          "type": "@xstate.registration",
        },
        {
          "event": "xstate.init",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:3",
          "snapshot": undefined,
          "type": "@xstate.transition",
        },
        {
          "event": "loadChild",
          "sessionId": "x:2",
          "snapshot": {
            "value": "loading",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "load",
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "$$xstate.resolve",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "done.invoke.(machine).loading:invocation[0]",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "toParent",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "toParent",
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "done.invoke.child",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "data": [Function],
          "type": "@xstate.action",
        },
        {
          "event": "done.invoke.child",
          "sessionId": "x:1",
          "snapshot": {
            "value": "success",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "done.invoke.(machine).loading:invocation[0]",
          "sessionId": "x:2",
          "snapshot": {
            "value": "loaded",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "$$xstate.resolve",
          "sessionId": "x:3",
          "snapshot": 42,
          "type": "@xstate.transition",
        },
      ]
    `);
  });

  it('can inspect actions', async () => {
    const machine = createMachine({
      entry: 'entry1',
      initial: 'a',
      states: {
        a: {
          entry: ['enter-a'],
          exit: ['exit-a'],
          on: {
            event: {
              actions: 'action1',
              target: 'b'
            }
          }
        },
        b: {
          entry: 'enter-b'
        }
      }
    });

    const events: InspectionEvent[] = [];

    const actor = createActor(machine, {
      inspect: {
        next: (event) => {
          events.push(event);
        }
      }
    });

    actor.start();

    actor.send({ type: 'event' });

    expect(events.map(simplifyEvent)).toMatchInlineSnapshot(`
      [
        {
          "sessionId": "x:4",
          "type": "@xstate.registration",
        },
        {
          "data": "entry1",
          "type": "@xstate.action",
        },
        {
          "data": "enter-a",
          "type": "@xstate.action",
        },
        {
          "event": "xstate.init",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "event": "xstate.init",
          "sessionId": "x:4",
          "snapshot": {
            "value": "a",
          },
          "type": "@xstate.transition",
        },
        {
          "event": "event",
          "sessionId": undefined,
          "snapshot": undefined,
          "type": "@xstate.event",
        },
        {
          "data": "exit-a",
          "type": "@xstate.action",
        },
        {
          "data": "action1",
          "type": "@xstate.action",
        },
        {
          "data": "enter-b",
          "type": "@xstate.action",
        },
        {
          "event": "event",
          "sessionId": "x:4",
          "snapshot": {
            "value": "b",
          },
          "type": "@xstate.transition",
        },
      ]
    `);
  });
});
