import {
  createActor,
  createMachine,
  fromPromise,
  sendParent,
  sendTo,
  waitFor,
  InspectionEvent,
  isMachineSnapshot,
  assign,
  ContextFrom,
  EventObject,
  AnyTransitionDefinition,
  raise,
  setup
} from '../src';
import { InspectedActionEvent } from '../src/inspection';

function simplifyEvents(
  inspectionEvents: InspectionEvent[],
  filter?: (ev: InspectionEvent) => boolean
) {
  return inspectionEvents
    .filter(filter ?? (() => true))
    .map((inspectionEvent) => {
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

      if (inspectionEvent.type === '@xstate.microstep') {
        return {
          type: inspectionEvent.type,
          value: (inspectionEvent.snapshot as any).value,
          event: inspectionEvent.event,
          transitions: inspectionEvent._transitions.map((t) => ({
            eventType: t.eventType,
            target: t.target?.map((target) => target.id) ?? []
          }))
        };
      }

      if (inspectionEvent.type === '@xstate.action') {
        return {
          type: inspectionEvent.type,
          action: inspectionEvent.action
        };
      }
    });
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

    expect(
      simplifyEvents(events, (ev) =>
        ['@xstate.actor', '@xstate.event', '@xstate.snapshot'].includes(ev.type)
      )
    ).toMatchInlineSnapshot(`
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

    expect(
      simplifyEvents(events, (ev) =>
        ['@xstate.actor', '@xstate.event', '@xstate.snapshot'].includes(ev.type)
      )
    ).toMatchInlineSnapshot(`
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
            "actorId": "0.(machine).loading",
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
            "actorId": "child",
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
            "actorId": "child",
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
            "actorId": "0.(machine).loading",
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

  it('can inspect microsteps from always events', async () => {
    const machine = createMachine({
      context: { count: 0 },
      initial: 'counting',
      states: {
        counting: {
          always: [
            { guard: ({ context }) => context.count === 3, target: 'done' },
            { actions: assign({ count: ({ context }) => context.count + 1 }) }
          ]
        },
        done: {}
      }
    });

    const events: InspectionEvent[] = [];

    createActor(machine, {
      inspect: (ev) => {
        events.push(ev);
      }
    }).start();

    expect(events).toMatchInlineSnapshot(`
      [
        {
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "rootId": "x:4",
          "type": "@xstate.actor",
        },
        {
          "_transitions": [
            {
              "actions": [
                [Function],
              ],
              "eventType": "",
              "guard": undefined,
              "reenter": false,
              "source": "#(machine).counting",
              "target": undefined,
              "toJSON": [Function],
            },
          ],
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "rootId": "x:4",
          "snapshot": {
            "children": {},
            "context": {
              "count": 1,
            },
            "error": undefined,
            "historyValue": {},
            "output": undefined,
            "status": "active",
            "tags": [],
            "value": "counting",
          },
          "type": "@xstate.microstep",
        },
        {
          "_transitions": [
            {
              "actions": [
                [Function],
              ],
              "eventType": "",
              "guard": undefined,
              "reenter": false,
              "source": "#(machine).counting",
              "target": undefined,
              "toJSON": [Function],
            },
          ],
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "rootId": "x:4",
          "snapshot": {
            "children": {},
            "context": {
              "count": 2,
            },
            "error": undefined,
            "historyValue": {},
            "output": undefined,
            "status": "active",
            "tags": [],
            "value": "counting",
          },
          "type": "@xstate.microstep",
        },
        {
          "_transitions": [
            {
              "actions": [
                [Function],
              ],
              "eventType": "",
              "guard": undefined,
              "reenter": false,
              "source": "#(machine).counting",
              "target": undefined,
              "toJSON": [Function],
            },
          ],
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "rootId": "x:4",
          "snapshot": {
            "children": {},
            "context": {
              "count": 3,
            },
            "error": undefined,
            "historyValue": {},
            "output": undefined,
            "status": "active",
            "tags": [],
            "value": "counting",
          },
          "type": "@xstate.microstep",
        },
        {
          "_transitions": [
            {
              "actions": [],
              "eventType": "",
              "guard": [Function],
              "reenter": false,
              "source": "#(machine).counting",
              "target": [
                "#(machine).done",
              ],
              "toJSON": [Function],
            },
          ],
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "rootId": "x:4",
          "snapshot": {
            "children": {},
            "context": {
              "count": 3,
            },
            "error": undefined,
            "historyValue": {},
            "output": undefined,
            "status": "active",
            "tags": [],
            "value": "done",
          },
          "type": "@xstate.microstep",
        },
        {
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "rootId": "x:4",
          "sourceRef": undefined,
          "type": "@xstate.event",
        },
        {
          "actorRef": {
            "id": "x:4",
            "xstate$$type": 1,
          },
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "rootId": "x:4",
          "snapshot": {
            "children": {},
            "context": {
              "count": 3,
            },
            "error": undefined,
            "historyValue": {},
            "output": undefined,
            "status": "active",
            "tags": [],
            "value": "done",
          },
          "type": "@xstate.snapshot",
        },
      ]
    `);
  });

  it('can inspect microsteps from raised events', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise({ type: 'to_b' }),
          on: { to_b: 'b' }
        },
        b: {
          entry: raise({ type: 'to_c' }),
          on: { to_c: 'c' }
        },
        c: {}
      }
    });

    const events: InspectionEvent[] = [];

    createActor(machine, {
      inspect: (ev) => {
        events.push(ev);
      }
    }).start();

    expect(simplifyEvents(events)).toMatchInlineSnapshot(`
      [
        {
          "actorId": "x:5",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "type": "to_b",
          },
          "transitions": [
            {
              "eventType": "to_b",
              "target": [
                "(machine).b",
              ],
            },
          ],
          "type": "@xstate.microstep",
          "value": "b",
        },
        {
          "event": {
            "type": "to_c",
          },
          "transitions": [
            {
              "eventType": "to_c",
              "target": [
                "(machine).c",
              ],
            },
          ],
          "type": "@xstate.microstep",
          "value": "c",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": undefined,
          "targetId": "x:5",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:5",
          "event": {
            "input": undefined,
            "type": "xstate.init",
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

  it('should inspect microsteps for normal transitions', () => {
    const events: any[] = [];
    const machine = createMachine({
      initial: 'a',
      states: {
        a: { on: { EV: 'b' } },
        b: {}
      }
    });
    const actorRef = createActor(machine, {
      inspect: (ev) => events.push(ev)
    }).start();
    actorRef.send({ type: 'EV' });

    expect(simplifyEvents(events)).toMatchInlineSnapshot(`
      [
        {
          "actorId": "x:6",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": undefined,
          "targetId": "x:6",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:6",
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
            "type": "EV",
          },
          "sourceId": undefined,
          "targetId": "x:6",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "EV",
          },
          "transitions": [
            {
              "eventType": "EV",
              "target": [
                "(machine).b",
              ],
            },
          ],
          "type": "@xstate.microstep",
          "value": "b",
        },
        {
          "actorId": "x:6",
          "event": {
            "type": "EV",
          },
          "snapshot": {
            "value": "b",
          },
          "status": "active",
          "type": "@xstate.snapshot",
        },
      ]
    `);
  });

  it('should inspect microsteps for eventless/always transitions', () => {
    const events: any[] = [];
    const machine = createMachine({
      initial: 'a',
      states: {
        a: { on: { EV: 'b' } },
        b: { always: 'c' },
        c: {}
      }
    });
    const actorRef = createActor(machine, {
      inspect: (ev) => events.push(ev)
    }).start();
    actorRef.send({ type: 'EV' });

    expect(simplifyEvents(events)).toMatchInlineSnapshot(`
      [
        {
          "actorId": "x:7",
          "type": "@xstate.actor",
        },
        {
          "event": {
            "input": undefined,
            "type": "xstate.init",
          },
          "sourceId": undefined,
          "targetId": "x:7",
          "type": "@xstate.event",
        },
        {
          "actorId": "x:7",
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
            "type": "EV",
          },
          "sourceId": undefined,
          "targetId": "x:7",
          "type": "@xstate.event",
        },
        {
          "event": {
            "type": "EV",
          },
          "transitions": [
            {
              "eventType": "EV",
              "target": [
                "(machine).b",
              ],
            },
          ],
          "type": "@xstate.microstep",
          "value": "b",
        },
        {
          "event": {
            "type": "EV",
          },
          "transitions": [
            {
              "eventType": "",
              "target": [
                "(machine).c",
              ],
            },
          ],
          "type": "@xstate.microstep",
          "value": "c",
        },
        {
          "actorId": "x:7",
          "event": {
            "type": "EV",
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

  it('should inspect actions', () => {
    const events: InspectedActionEvent[] = [];

    const machine = setup({
      actions: {
        enter1: () => {},
        exit1: () => {},
        stringAction: () => {},
        namedAction: () => {}
      }
    }).createMachine({
      entry: 'enter1',
      exit: 'exit1',
      initial: 'loading',
      states: {
        loading: {
          on: {
            event: {
              target: 'done',
              actions: [
                'stringAction',
                { type: 'namedAction', params: { foo: 'bar' } },
                () => {
                  /* inline */
                }
              ]
            }
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine, {
      inspect: (ev) => {
        if (ev.type === '@xstate.action') {
          events.push(ev);
        }
      }
    });

    actor.start();
    actor.send({ type: 'event' });

    expect(simplifyEvents(events, (ev) => ev.type === '@xstate.action'))
      .toMatchInlineSnapshot(`
      [
        {
          "action": {
            "params": undefined,
            "type": "enter1",
          },
          "type": "@xstate.action",
        },
        {
          "action": {
            "params": undefined,
            "type": "stringAction",
          },
          "type": "@xstate.action",
        },
        {
          "action": {
            "params": {
              "foo": "bar",
            },
            "type": "namedAction",
          },
          "type": "@xstate.action",
        },
        {
          "action": {
            "params": undefined,
            "type": "(anonymous)",
          },
          "type": "@xstate.action",
        },
        {
          "action": {
            "params": undefined,
            "type": "exit1",
          },
          "type": "@xstate.action",
        },
      ]
    `);
  });

  it('@xstate.microstep inspection events should report no transitions if an unknown event was sent', () => {
    const machine = createMachine({});
    expect.assertions(1);

    const actor = createActor(machine, {
      inspect: (ev) => {
        if (ev.type === '@xstate.microstep') {
          expect(ev._transitions.length).toBe(0);
        }
      }
    });

    actor.start();
    actor.send({ type: 'any' });
  });
});
