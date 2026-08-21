import { createActor, createMachine, type ActorRefFrom } from '../src';
import z from 'zod';

describe('internalEvents', () => {
  it('supports separately declared internal event schemas', async () => {
    const machine = createMachine({
      schemas: {
        events: {
          start: z.object({})
        },
        internalEvents: {
          tick: z.object({ count: z.number() }),
          'change.*': z.object({ value: z.string() })
        }
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            start: (_, enq) => {
              enq.raise({ type: 'tick', count: 1 });
              enq.raise({ type: 'change.value', value: 'ready' });
            },
            tick: {},
            'change.value': { target: 'done' }
          }
        },
        done: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'start' });

    expect(actor.getSnapshot().value).toBe('done');
    expect(
      await machine.eventSchema['~standard'].validate({
        type: 'change.value',
        value: 'ready'
      })
    ).toEqual({
      value: { type: 'change.value', value: 'ready' }
    });
    actor.system.runtime = { sendEvent: () => {} };
    expect(() => actor.send({ type: 'tick', count: 2 } as any)).toThrow(
      'Internal event "tick" cannot be sent to actor'
    );
  });

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

    const actor = createActor(machine).start();

    expect(() => actor.send({ type: 'tick' } as any)).toThrow(
      'Internal event "tick" cannot be sent to actor'
    );
    expect(actor.getSnapshot().value).toBe('idle');
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

    const actor = createActor(machine).start();

    expect(() =>
      actor.send(
        // @ts-expect-error
        { type: 'change.value', value: 'x' }
      )
    ).toThrow('Internal event "change.value" cannot be sent to actor');
    expect(actor.getSnapshot().value).toBe('idle');
  });
});

it('an untyped machine keeps its sendable events (type-level)', () => {
  // Broad TConfig collapses internal-event descriptors to `string`; that
  // must classify nothing rather than everything (send would become never).
  const machine = createMachine({
    initial: 'a',
    states: { a: { on: { NEXT: { target: 'a' } } } }
  });
  const actor = createActor(machine).start();
  actor.send({ type: 'NEXT' });
  const ref: ActorRefFrom<typeof machine> = actor;
  ref.send({ type: 'NEXT' });
  actor.stop();
});
