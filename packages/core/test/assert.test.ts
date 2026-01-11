import { createActor, createMachine, assertEvent } from '../src';

describe('assertion helpers', () => {
  it('assertEvent asserts the correct event type', () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    const machine = createMachine(
      {
        types: {
          events: {} as
            | { type: 'greet'; message: string }
            | { type: 'count'; value: number }
        },
        on: {
          greet: { actions: 'greet' },
          count: { actions: 'greet' }
        }
      },
      {
        actions: {
          greet: ({ event }) => {
            // @ts-expect-error
            event.message;

            assertEvent(event, 'greet');
            event.message satisfies string;

            // @ts-expect-error
            event.count;
          }
        }
      }
    );

    const actor = createActor(machine);

    actor.subscribe({
      error(err) {
        expect(err).toMatchInlineSnapshot(
          `[Error: Expected event {"type":"count","value":42} to have type matching "greet"]`
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
    const machine = createMachine(
      {
        types: {
          events: {} as
            | { type: 'greet'; message: string }
            | { type: 'notify'; message: string; level: 'info' | 'error' }
            | { type: 'count'; value: number }
        },
        on: {
          greet: { actions: 'greet' },
          count: { actions: 'greet' }
        }
      },
      {
        actions: {
          greet: ({ event }) => {
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
          }
        }
      }
    );

    const actor = createActor(machine);

    actor.subscribe({
      error(err) {
        expect(err).toMatchInlineSnapshot(
          `[Error: Expected event {"type":"count","value":42} to have one of types matching "greet", "notify"]`
        );
        resolve();
      }
    });

    actor.start();

    actor.send({ type: 'count', value: 42 });

    return promise;
  });
});
