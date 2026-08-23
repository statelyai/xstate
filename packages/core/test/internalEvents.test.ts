import { createActor, createMachine, type EventRejection } from '../src';
import z from 'zod';

describe('internalEvents', () => {
  it('allows raising internal events', () => {
    const machine = createMachine({
      schemas: {
        events: {
          foo: z.object({}),
          tick: z.object({})
        }
      },
      internalEvents: ['tick'] as const,
      initial: 'idle',
      states: {
        idle: {
          on: {
            foo: (_, enq) => {
              enq.raise({ type: 'tick' });
            },
            tick: { target: 'done' }
          }
        },
        done: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'foo' });

    expect(actor.getSnapshot().value).toBe('done');
  });

  it('rejects sending internal events from outside', () => {
    const machine = createMachine({
      schemas: {
        events: {
          foo: z.object({}),
          tick: z.object({})
        }
      },
      internalEvents: ['tick'] as const,
      initial: 'idle',
      states: {
        idle: {
          on: {
            foo: { target: 'done' },
            tick: { target: 'done' }
          }
        },
        done: {}
      }
    });

    const rejections: EventRejection[] = [];
    const actor = createActor(machine, {
      onRejectedEvent: (rejection) => rejections.push(rejection)
    }).start();

    actor.send({ type: 'tick' } as any);

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().status).toBe('active');
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      event: { type: 'tick' },
      targetId: actor.id,
      eventOrigin: 'external',
      reason: 'internalEvent'
    });
    expect(rejections[0].error.message).toMatch(
      'Internal event "tick" cannot be sent to actor'
    );
  });

  it('rejects sending wildcard-matched internal events from outside', () => {
    const machine = createMachine({
      schemas: {
        events: {
          'change.value': z.object({ value: z.string() })
        }
      },
      internalEvents: ['change.*'] as const,
      initial: 'idle',
      states: {
        idle: {
          on: {
            'change.value': { target: 'done' }
          }
        },
        done: {}
      }
    });

    const rejections: EventRejection[] = [];
    const actor = createActor(machine, {
      onRejectedEvent: (rejection) => rejections.push(rejection)
    }).start();

    actor.send(
      // @ts-expect-error
      { type: 'change.value', value: 'x' }
    );

    expect(actor.getSnapshot().value).toBe('idle');
    expect(rejections).toHaveLength(1);
    expect(rejections[0].reason).toBe('internalEvent');
    expect(rejections[0].error.message).toMatch(
      'Internal event "change.value" cannot be sent to actor'
    );
  });
});
