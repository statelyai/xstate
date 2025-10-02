import { z } from 'zod';
import {
  createActor,
  next_createMachine,
  fromPromise,
  waitFor,
  InspectionEvent,
  isMachineSnapshot
} from '../src';
import { XSTATE_INIT } from '../src/constants';
// import removed: action events are unified under '@xstate.transition'

function simplifyEvents(
  inspectionEvents: InspectionEvent[],
  filter?: (ev: InspectionEvent) => boolean
) {
  return inspectionEvents
    .filter(filter ?? (() => true))
    .map((inspectionEvent) => {
      if (inspectionEvent.type === '@xstate.transition') {
        return {
          type: inspectionEvent.type,
          sourceId: inspectionEvent.sourceRef?.sessionId,
          targetId:
            inspectionEvent.targetRef?.sessionId ??
            inspectionEvent.actorRef.sessionId,
          event: inspectionEvent.event,
          eventType: inspectionEvent.eventType,
          snapshot: isMachineSnapshot(inspectionEvent.snapshot)
            ? {
                value: (inspectionEvent.snapshot as any).value,
                context: (inspectionEvent.snapshot as any).context
              }
            : inspectionEvent.snapshot,
          status: (inspectionEvent.snapshot as any).status,
          microsteps: (inspectionEvent.microsteps || []).map((t: any) => ({
            eventType: t.eventType,
            target: t.target?.map((target: any) => target.id) ?? []
          }))
        } as any;
      }
    })
    .filter(Boolean as any);
}

describe('inspect', () => {
  it('the .inspect option can observe inspection events', async () => {
    const machine = next_createMachine({
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
      inspect: (ev) => events.push(ev),
      id: 'parent'
    });
    actor.start();

    actor.send({ type: 'NEXT' });
    actor.send({ type: 'NEXT' });

    const simplified = simplifyEvents(
      events,
      (ev) => ev.type === '@xstate.transition'
    ) as any[];
    expect(simplified.map((e) => e.event.type)).toEqual([
      '@xstate.init',
      'NEXT',
      'NEXT'
    ]);
    expect(simplified.map((e) => e.snapshot.value)).toEqual(['a', 'b', 'c']);
  });

  it('can inspect communications between actors', async () => {
    const parentMachine = next_createMachine({
      initial: 'waiting',
      states: {
        waiting: {},
        success: {}
      },
      invoke: {
        src: next_createMachine({
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
                onDone: ({ parent }) => {
                  parent?.send({ type: 'toParent' });
                  return {
                    target: 'loaded'
                  };
                }
              }
            },
            loaded: {
              type: 'final'
            }
          }
        }),
        id: 'child',
        onDone: (_, enq) => {
          enq(() => {});
          return {
            target: '.success'
          };
        }
      },
      on: {
        load: ({ children }) => {
          children.child.send({ type: 'loadChild' });
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

    const simplified = simplifyEvents(
      events,
      (ev) => ev.type === '@xstate.transition'
    ) as any[];
    expect(
      simplified.filter((e) => e.event.type === XSTATE_INIT).length
    ).toBeGreaterThanOrEqual(2);
    const parentEvents = simplified.filter((e) => e.targetId === 'x:0');
    expect(parentEvents[parentEvents.length - 1].snapshot.value).toBe(
      'success'
    );
  });

  it('can inspect microsteps from always events', async () => {
    const machine = next_createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 0 },
      initial: 'counting',
      states: {
        counting: {
          always: ({ context }) => {
            if (context.count === 3) {
              return {
                target: 'done'
              };
            }
            return {
              context: {
                ...context,
                count: context.count + 1
              }
            };
          }
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

    const simplified = simplifyEvents(
      events,
      (ev) => ev.type === '@xstate.transition'
    ) as any[];
    expect(simplified).toHaveLength(1);
    expect(simplified[0].event.type).toBe(XSTATE_INIT);
    expect(simplified[0].snapshot.value).toBe('done');
    expect((simplified[0] as any).snapshot.context.count).toBe(3);
    expect(simplified[0].microsteps.length).toBeGreaterThan(0);
  });

  it('can inspect microsteps from raised events', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'to_b' });
          },
          on: { to_b: 'b' }
        },
        b: {
          entry: (_, enq) => {
            enq.raise({ type: 'to_c' });
          },
          on: { to_c: 'c' }
        },
        c: {}
      }
    });

    const events: InspectionEvent[] = [];

    const actor = createActor(machine, {
      inspect: (ev) => {
        events.push(ev);
      }
    }).start();

    expect(actor.getSnapshot().matches('c')).toBe(true);

    const simplified = simplifyEvents(events) as any[];
    expect(simplified).toHaveLength(1);
    const ms = simplified[0].microsteps.map((m: any) => m.eventType);
    expect(ms).toEqual(['to_b', 'to_c']);
    expect(simplified[0].snapshot.value).toBe('c');
  });

  it('should inspect microsteps for normal transitions', () => {
    const events: any[] = [];
    const machine = next_createMachine({
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

    const simplified = simplifyEvents(events) as any[];
    expect(simplified.map((e) => e.event.type)).toEqual([XSTATE_INIT, 'EV']);
    expect(simplified.map((e) => e.snapshot.value)).toEqual(['a', 'b']);
  });

  it('should inspect microsteps for eventless/always transitions', () => {
    const events: any[] = [];
    const machine = next_createMachine({
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

    const simplified = simplifyEvents(events) as any[];
    expect(simplified).toHaveLength(2);
    expect(simplified[0].event.type).toBe(XSTATE_INIT);
    expect(simplified[0].snapshot.value).toBe('a');
    expect(simplified[1].event.type).toBe('EV');
    expect(simplified[1].snapshot.value).toBe('c');
    const stepTypes = simplified[1].microsteps.map((m: any) => m.eventType);
    expect(stepTypes).toEqual(['EV', '']);
  });

  // TODO: fix way actions are inspected
  it('should inspect transitions when actions run', () => {
    const events: InspectionEvent[] = [];

    const enter1 = () => {};
    const exit1 = () => {};
    const stringAction = () => {};
    const namedAction = (_params: { foo: string }) => {};

    const machine = next_createMachine({
      entry: (_, enq) => enq(enter1),
      exit: (_, enq) => enq(exit1),
      initial: 'loading',
      states: {
        loading: {
          on: {
            event: (_, enq) => {
              enq(stringAction);
              enq(namedAction, { foo: 'bar' });
              enq(() => {});
              return { target: 'done' };
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
        if (ev.type === '@xstate.transition') {
          events.push(ev);
        }
      }
    });

    actor.start();
    actor.send({ type: 'event' });

    const simplified = simplifyEvents(
      events,
      (ev) => ev.type === '@xstate.transition'
    ) as any[];
    expect(simplified.length).toBeGreaterThanOrEqual(2);
    const last = simplified[simplified.length - 1];
    expect(last.event.type).toBe('event');
    expect(last.snapshot.value).toBe('done');
    const stepTypes = last.microsteps.map((m: any) => m.eventType);
    expect(stepTypes).toContain('event');
  });

  it('@xstate.transition inspection event should report no microsteps if an unknown event was sent', () => {
    const machine = next_createMachine({});
    const events: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (ev) => {
        events.push(ev);
      }
    });

    actor.start();
    actor.send({ type: 'any' });
    const simplified = simplifyEvents(
      events,
      (ev) => ev.type === '@xstate.transition'
    ) as any[];
    const last = simplified[simplified.length - 1];
    expect(last.event.type).toBe('any');
    expect(last.microsteps.length).toBe(0);
  });

  it('actor.system.inspect(…) can inspect actors', () => {
    const actor = createActor(next_createMachine({}));
    const events: InspectionEvent[] = [];

    actor.system.inspect((ev) => {
      events.push(ev);
    });

    actor.start();

    expect(events.some((e) => e.type === '@xstate.transition')).toBe(true);
  });

  it('actor.system.inspect(…) can inspect actors (observer)', () => {
    const actor = createActor(next_createMachine({}));
    const events: InspectionEvent[] = [];

    actor.system.inspect({
      next: (ev) => {
        events.push(ev);
      }
    });

    actor.start();

    expect(events.some((e) => e.type === '@xstate.transition')).toBe(true);
  });

  it('actor.system.inspect(…) can be unsubscribed', () => {
    const actor = createActor(next_createMachine({}));
    const events: InspectionEvent[] = [];

    const sub = actor.system.inspect((ev) => {
      events.push(ev);
    });

    actor.start();

    expect(events.some((e) => e.type === '@xstate.transition')).toBe(true);

    events.length = 0;

    sub.unsubscribe();

    actor.send({ type: 'someEvent' });
    expect(events.length).toEqual(0);
  });

  it('actor.system.inspect(…) can be unsubscribed (observer)', () => {
    const actor = createActor(next_createMachine({}));
    const events: InspectionEvent[] = [];

    const sub = actor.system.inspect({
      next: (ev) => {
        events.push(ev);
      }
    });

    actor.start();

    expect(events.some((e) => e.type === '@xstate.transition')).toBe(true);

    events.length = 0;

    sub.unsubscribe();

    actor.send({ type: 'someEvent' });
    expect(events.length).toEqual(0);
  });
});
