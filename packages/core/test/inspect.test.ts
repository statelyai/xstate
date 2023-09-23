import {
  createActor,
  createMachine,
  fromPromise,
  sendParent,
  sendTo,
  waitFor
} from '../src';
import { InspectionEvent } from '../src/system';

function simplifyEvent(inspectionEvent: InspectionEvent) {
  if (inspectionEvent.type === '@xstate.event') {
    return {
      type: inspectionEvent.type,
      sessionId: inspectionEvent.sessionId,
      targetId: inspectionEvent.targetId,
      event: inspectionEvent.event
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
      event: inspectionEvent.event,
      status: inspectionEvent.snapshot.status
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

    const actor = createActor(machine, {
      inspect: {
        next(event) {
          events.push(event);
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
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": "x:0",
          "snapshot": {
            "value": "a",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "type": "NEXT",
          },
          "sessionId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "NEXT",
          },
          "sessionId": "x:0",
          "snapshot": {
            "value": "b",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "type": "NEXT",
          },
          "sessionId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "NEXT",
          },
          "sessionId": "x:0",
          "snapshot": {
            "value": "c",
          },
          "status": "active",
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

    const actor = createActor(parentMachine, {
      inspect: {
        next: (event) => {
          events.push(event);
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
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": undefined,
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": "x:1",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": "x:2",
          "snapshot": {
            "value": "start",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "type": "load",
          },
          "sessionId": undefined,
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "loadChild",
          },
          "sessionId": "x:1",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "sessionId": "x:3",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": "x:2",
          "targetId": "x:3",
          "type": "@xstate.event",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sessionId": "x:3",
          "snapshot": {
            "error": undefined,
            "input": undefined,
            "output": undefined,
            "status": "active",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "type": "loadChild",
          },
          "sessionId": "x:2",
          "snapshot": {
            "value": "loading",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "type": "load",
          },
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "data": 42,
            "type": "$$xstate.resolve",
          },
          "sessionId": "x:3",
          "targetId": "x:3",
          "type": "@xstate.event",
        },
        {
          "event": {
            "output": 42,
            "type": "xstate.done.actor.(machine).loading:invocation[0]",
          },
          "sessionId": "x:3",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "toParent",
          },
          "sessionId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "toParent",
          },
          "sessionId": "x:1",
          "snapshot": {
            "value": "waiting",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "output": undefined,
            "type": "xstate.done.actor.child",
          },
          "sessionId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": {
            "output": undefined,
            "type": "xstate.done.actor.child",
          },
          "sessionId": "x:1",
          "snapshot": {
            "value": "success",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "output": 42,
            "type": "xstate.done.actor.(machine).loading:invocation[0]",
          },
          "sessionId": "x:2",
          "snapshot": {
            "value": "loaded",
          },
          "status": "done",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "data": 42,
            "type": "$$xstate.resolve",
          },
          "sessionId": "x:3",
          "snapshot": {
            "error": undefined,
            "input": undefined,
            "output": 42,
            "status": "done",
          },
          "status": "done",
          "type": "@xstate.snapshot",
        },
      ]
    `);
  });
});
