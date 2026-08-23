import { z } from 'zod';
import {
  createActor,
  createMachine,
  initialTransition,
  setup,
  transition,
  type AnyEventObject,
  type EventRejection,
  type InspectionEvent
} from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';
import { createDurable } from '../src/durable/index.ts';

const createValidatedMachine = () =>
  setup({
    validator: standardSchemaValidator(),
    schemas: {
      events: {
        GO: z.object({ count: z.number() }),
        FINISH: z.object({})
      }
    }
  }).createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          GO: { target: 'going' },
          FINISH: { target: 'done' }
        }
      },
      going: {
        on: { FINISH: { target: 'done' } }
      },
      done: { type: 'final' }
    }
  });

describe('event boundary: reject and report', () => {
  it('rejects an invalid external event on send without erroring the actor', () => {
    const rejections: EventRejection[] = [];
    const inspection: InspectionEvent[] = [];
    const actor = createActor(createValidatedMachine(), {
      onRejectedEvent: (rejection) => rejections.push(rejection),
      inspect: (event) => inspection.push(event)
    }).start();

    actor.send({ type: 'GO', count: 'oops' } as any);

    // the event never entered the machine
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().status).toBe('active');

    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      event: { type: 'GO', count: 'oops' },
      targetId: actor.id,
      eventOrigin: 'external',
      reason: 'invalidEvent'
    });
    expect(rejections[0].issues?.length).toBeGreaterThan(0);

    const rejected = inspection.find(
      (event) => event.type === '@xstate.event.rejected'
    );
    expect(rejected).toMatchObject({
      event: { type: 'GO', count: 'oops' },
      eventOrigin: 'external',
      reason: 'invalidEvent'
    });

    // the actor still processes valid events afterwards
    actor.send({ type: 'GO', count: 1 });
    expect(actor.getSnapshot().value).toBe('going');
  });

  it('rejects an invalid event sent from another actor with eventOrigin "actor"', () => {
    const child = createValidatedMachine();
    const rejections: EventRejection[] = [];
    const parent = createMachine({
      invoke: { id: 'child', src: child },
      on: {
        forward: ({ children }, enq) => {
          enq.sendTo(children.child!, { type: 'GO', count: 'bad' } as any);
        }
      }
    });
    const actor = createActor(parent, {
      onRejectedEvent: (rejection) => rejections.push(rejection)
    }).start();

    actor.send({ type: 'forward' });

    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      event: { type: 'GO', count: 'bad' },
      targetId: 'child',
      eventOrigin: 'actor',
      reason: 'invalidEvent'
    });
    expect(rejections[0].sourceRef).toBe(actor);
    expect(actor.getSnapshot().status).toBe('active');
    expect(actor.getSnapshot().children.child!.getSnapshot().status).toBe(
      'active'
    );
  });

  it('warns on rejection in development mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const actor = createActor(createValidatedMachine()).start();
      actor.send({ type: 'GO', count: 'oops' } as any);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch('Event "GO" was rejected');
    } finally {
      warn.mockRestore();
    }
  });

  it('rejects queued deliveries of internal event types from outside', () => {
    const machine = createMachine({
      schemas: { events: { tick: z.object({}) } },
      internalEvents: ['tick'] as const,
      initial: 'idle',
      states: {
        idle: { on: { tick: { target: 'done' } } },
        done: {}
      }
    });
    const rejections: EventRejection[] = [];
    const actor = createActor(machine, {
      onRejectedEvent: (rejection) => rejections.push(rejection)
    }).start();

    (actor.send as (event: AnyEventObject) => void)({ type: 'tick' });

    expect(actor.getSnapshot().value).toBe('idle');
    expect(rejections[0]).toMatchObject({
      eventOrigin: 'external',
      reason: 'internalEvent'
    });
  });

  it('pure transition() returns the snapshot unchanged with a rejection effect', () => {
    const machine = createValidatedMachine();
    const [snapshot] = initialTransition(machine);

    const [nextSnapshot, effects] = transition(machine, snapshot, {
      type: 'GO',
      count: 'oops'
    } as any);

    expect(nextSnapshot).toBe(snapshot);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: 'builtin',
      type: '@xstate.rejectEvent'
    });
    const { rejection } = effects[0] as unknown as {
      rejection: EventRejection;
    };
    expect(rejection).toMatchObject({
      event: { type: 'GO', count: 'oops' },
      eventOrigin: 'external',
      reason: 'invalidEvent'
    });
  });

  it('internal faults still error: an invalid delayed raise errors the actor', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: {
          START: z.object({}),
          tick: z.object({ count: z.number() })
        }
      }
    }).createMachine({
      internalEvents: ['tick'] as const,
      initial: 'idle',
      states: {
        idle: {
          on: {
            START: (_, enq) => {
              enq.raise({ type: 'tick', count: 'bad' } as any, { delay: 10 });
            },
            tick: {}
          }
        }
      }
    });

    // pure transition throws — a machine bug must be loud
    const [snapshot] = initialTransition(machine);
    expect(() => transition(machine, snapshot, { type: 'START' })).toThrow(
      /tick/
    );

    // the running actor errors
    const rejections: EventRejection[] = [];
    const actor = createActor(machine, {
      onRejectedEvent: (rejection) => rejections.push(rejection)
    });
    actor.subscribe({ error: () => {} });
    actor.start();
    actor.send({ type: 'START' });
    expect(actor.getSnapshot().status).toBe('error');
    expect(rejections).toHaveLength(0);
  });

  describe('durable execution', () => {
    it('journals rejections through onRejectedEvent and keeps replay total', async () => {
      const machine = createValidatedMachine();
      const queue: AnyEventObject[] = [
        { type: 'GO', count: 'poisoned' },
        { type: 'GO', count: 1 },
        { type: 'FINISH' }
      ];
      const rejected: Array<{
        rejection: EventRejection;
        transitionIndex: number;
      }> = [];

      const execution = createDurable(machine, {
        executeAction: () => {},
        runtime: () => ({ terminateActor: () => {} }),
        onRejectedEvent: (rejection, metadata) => {
          rejected.push({
            rejection,
            transitionIndex: metadata.transitionIndex
          });
        },
        waitForEvent: () => queue.shift() as any
      });

      await execution.run();

      expect(queue).toHaveLength(0);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].rejection).toMatchObject({
        event: { type: 'GO', count: 'poisoned' },
        eventOrigin: 'external',
        reason: 'invalidEvent'
      });
    });

    it('replaying a poisoned event yields the same unchanged snapshot (totality)', () => {
      const machine = createValidatedMachine();
      const execution = createDurable(machine, {
        executeAction: () => {},
        waitForEvent: () => {
          throw new Error('unused');
        }
      });

      const [snapshot] = execution.initialTransition();
      const poisoned = { type: 'GO', count: 'poisoned' } as any;

      const [first, firstEffects] = execution.transition(snapshot, poisoned);
      const [second, secondEffects] = execution.transition(snapshot, poisoned);

      expect(first).toBe(snapshot);
      expect(second).toBe(snapshot);
      expect(firstEffects[0].effect).toMatchObject({
        type: '@xstate.rejectEvent'
      });
      expect(secondEffects[0].effect).toMatchObject({
        type: '@xstate.rejectEvent'
      });
      // no throw anywhere: replay stays total with poisoned queued events
    });
  });
});
