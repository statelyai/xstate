import {
  createActor,
  createMachine,
  fromPromise,
  sendParent,
  sendTo,
  waitFor,
  InspectionEvent,
  isMachineSnapshot
} from '../src';

function simplifyEvent(inspectionEvent: InspectionEvent) {
  if (inspectionEvent.type === '@xstate.event') {
    return {
      type: inspectionEvent.type,
      sourceId: inspectionEvent.sourceRef?.sessionId,
      targetId: inspectionEvent.actorRef.sessionId,
      event: inspectionEvent.event
    };
  }
  if (inspectionEvent.type === '@xstate.actor') {
    return {
      type: inspectionEvent.type,
      actorId: inspectionEvent.actorRef.sessionId
    };
  }

  if (inspectionEvent.type === '@xstate.snapshot') {
    return {
      type: inspectionEvent.type,
      actorId: inspectionEvent.actorRef.sessionId,
      snapshot: isMachineSnapshot(inspectionEvent.snapshot)
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
      inspect: (ev) => events.push(ev)
    });
    actor.start();

    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    expect(events.map(simplifyEvent)).toMatchInlineSnapshot(`
      [
        {
          "actorId": "x:0",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:0",
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
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
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:0",
          "event": {
            "type": "NEXT",
          },
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
          "sourceId": undefined,
          "targetId": "x:0",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:0",
          "event": {
            "type": "NEXT",
          },
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
          "actorId": "x:1",
          "type": "@xstate.actor",
        },
        {
          "actorId": "x:2",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": undefined,
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": "x:1",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:2",
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "snapshot": {
            "value": "start",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "actorId": "x:1",
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
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
          "sourceId": undefined,
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "loadChild",
          },
          "sourceId": "x:1",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:3",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": "x:2",
          "targetId": "x:3",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:3",
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
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
          "actorId": "x:2",
          "event": {
            "type": "loadChild",
          },
          "snapshot": {
            "value": "loading",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "actorId": "x:1",
          "event": {
            "type": "load",
          },
          "snapshot": {
            "value": "waiting",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "event": {
            "data": 42,
            "type": "xstate.promise.resolve",
          },
          "sourceId": "x:3",
          "targetId": "x:3",
          "type": "@xstate.event",
        },
        {
          "event": {
            "output": 42,
            "type": "xstate.done.actor.0.(machine).loading",
          },
          "sourceId": "x:3",
          "targetId": "x:2",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "toParent",
          },
          "sourceId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:1",
          "event": {
            "type": "toParent",
          },
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
          "sourceId": "x:2",
          "targetId": "x:1",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:1",
          "event": {
            "output": undefined,
            "type": "xstate.done.actor.child",
          },
          "snapshot": {
            "value": "success",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
        {
          "actorId": "x:2",
          "event": {
            "output": 42,
            "type": "xstate.done.actor.0.(machine).loading",
          },
          "snapshot": {
            "value": "loaded",
          },
          "status": "done",
          "type": "@xstate.snapshot",
        },
        {
          "actorId": "x:3",
          "event": {
            "data": 42,
            "type": "xstate.promise.resolve",
          },
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
