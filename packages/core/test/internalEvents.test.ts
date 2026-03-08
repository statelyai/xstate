import { createActor, createMachine } from '../src';
import z from 'zod';

describe('internalEvents', () => {
  it('allows raising internal events', () => {
    const machine = createMachine({
      setup: {
        events: {
          foo: z.object({}),
          tick: z.object({})
        },
        internalEvents: ['tick'] as const
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            foo: (_, enq) => {
              enq.raise({ type: 'tick' });
            },
            tick: 'done'
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
      setup: {
        events: {
          foo: z.object({}),
          tick: z.object({})
        },
        internalEvents: ['tick'] as const
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            foo: 'done',
            tick: 'done'
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
      setup: {
        events: {
          'change.value': z.object({ value: z.string() })
        },
        internalEvents: ['change.*'] as const
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            'change.value': 'done'
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
