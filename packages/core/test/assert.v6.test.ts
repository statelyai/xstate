import { z } from 'zod';
import { createActor, createMachine, assertEvent } from '../src';

describe('assertion helpers', () => {
  it('assertEvent asserts the correct event type', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    type TestEvent =
      | { type: 'greet'; message: string }
      | { type: 'count'; value: number };

    const greet = (event: TestEvent) => {
      // @ts-expect-error
      event.message;

      assertEvent(event, 'greet');
      event.message satisfies string;

      // @ts-expect-error
      event.count;
    };

    const machine = createMachine({
      schemas: {
        events: {
          greet: z.object({ message: z.string() }),
          count: z.object({ value: z.number() })
        }
      },

      on: {
        greet: ({ event }, enq) => {
          enq(() => greet(event));
        },
        count: ({ event }) => {
          greet(event);
        }
      }
    });

    const actor = createActor(machine);

    actor.subscribe({
      error(err) {
        expect(err).toMatchInlineSnapshot(
          `[Error: Expected event {"type":"count","value":42} to have type "greet"]`
        );
        resolve();
      }
    });

    actor.start();

    actor.send({ type: 'count', value: 42 });

    return promise;
  });

  it('assertEvent asserts multiple event types', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    type TestEvent =
      | { type: 'greet'; message: string }
      | { type: 'notify'; message: string; level: 'info' | 'error' }
      | { type: 'count'; value: number };

    const greet = (event: TestEvent) => {
      // @ts-expect-error
      event.message;

      assertEvent(event, ['greet', 'notify']);
      event.message satisfies string;

      // @ts-expect-error
      event.level;

      assertEvent(event, ['notify']);
      event.level satisfies 'info' | 'error';

      // @ts-expect-error
      event.count;
    };

    const machine = createMachine({
      schemas: {
        events: {
          greet: z.object({ message: z.string() }),
          notify: z.object({
            message: z.string(),
            level: z.enum(['info', 'error'])
          }),
          count: z.object({ value: z.number() })
        }
      },

      on: {
        greet: ({ event }, enq) => {
          enq(() => greet(event));
        },
        count: ({ event }, enq) => {
          enq(() => greet(event));
        }
      }
    });

    const actor = createActor(machine);

    actor.subscribe({
      error(err) {
        expect(err).toMatchInlineSnapshot(
          `[Error: Expected event {"type":"count","value":42} to have one of types "greet", "notify"]`
        );
        resolve();
      }
    });

    actor.start();

    actor.send({ type: 'count', value: 42 });

    return promise;
  });
});
