import { z } from 'zod';
import { createActor, next_createMachine, assertEvent } from '../src';

describe('assertion helpers', () => {
  it('assertEvent asserts the correct event type', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const events = z.union([
      z.object({ type: z.literal('greet'), message: z.string() }),
      z.object({ type: z.literal('count'), value: z.number() })
    ]);
    const greet = (event: z.infer<typeof events>) => {
      // @ts-expect-error
      event.message;

      assertEvent(event, 'greet');
      event.message satisfies string;

      // @ts-expect-error
      event.count;
    };

    const machine = next_createMachine({
      // types: {
      //   events: {} as
      //     | { type: 'greet'; message: string }
      //     | { type: 'count'; value: number }
      // },
      schemas: {
        events: events
      },
      on: {
        greet: ({ event }, enq) => enq.action(greet, event),
        count: ({ event }, enq) => enq.action(greet, event)
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
    const events = z.union([
      z.object({ type: z.literal('greet'), message: z.string() }),
      z.object({ type: z.literal('count'), value: z.number() }),
      z.object({
        type: z.literal('notify'),
        message: z.string(),
        level: z.enum(['info', 'error'])
      })
    ]);
    const greet = (event: z.infer<typeof events>) => {
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
    const machine = next_createMachine({
      schemas: {
        events: events
      },
      on: {
        greet: ({ event }, enq) => enq.action(greet, event),
        count: ({ event }, enq) => enq.action(greet, event)
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
