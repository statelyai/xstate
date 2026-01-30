import { createMachine, createActor } from '../src/index.ts';
import { z } from 'zod';

describe('actor.trigger', () => {
  it('should send events via trigger', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            NEXT: 'active'
          }
        },
        active: {}
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toBe('idle');

    actor.trigger.NEXT();

    expect(actor.getSnapshot().value).toBe('active');
  });

  it('should send events with payload via trigger', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: {
          INC: z.object({ by: z.number() })
        }
      },
      context: { count: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            INC: ({ context, event }) => ({
              context: { count: context.count + event.by }
            })
          }
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().context.count).toBe(0);

    actor.trigger.INC({ by: 5 });

    expect(actor.getSnapshot().context.count).toBe(5);
  });

  it('should work with events with only type (no payload)', () => {
    const events: string[] = [];

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: (_, enq) => {
              enq(() => events.push('GO'));
              return { target: 'b' };
            }
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine).start();

    actor.trigger.GO();

    expect(events).toEqual(['GO']);
    expect(actor.getSnapshot().value).toBe('b');
  });

  it('should work with multiple event types', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({ count: z.number() }),
        events: {
          INC: z.object({}),
          DEC: z.object({}),
          SET: z.object({ value: z.number() })
        }
      },
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            INC: ({ context }) => ({
              context: { count: context.count + 1 }
            }),
            DEC: ({ context }) => ({
              context: { count: context.count - 1 }
            }),
            SET: ({ event }) => ({
              context: { count: event.value }
            })
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.trigger.INC();
    expect(actor.getSnapshot().context.count).toBe(1);

    actor.trigger.INC();
    expect(actor.getSnapshot().context.count).toBe(2);

    actor.trigger.DEC();
    expect(actor.getSnapshot().context.count).toBe(1);

    actor.trigger.SET({ value: 100 });
    expect(actor.getSnapshot().context.count).toBe(100);
  });
});
