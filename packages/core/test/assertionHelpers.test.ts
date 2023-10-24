import { createActor, createMachine } from '../src';
import { assertEvent } from '../src/assert';

describe('assertion helpers', () => {
  it('assertEvent asserts the correct event type', (done) => {
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
          `[Error: Expected event {"type":"count","value":42} to have type "greet"]`
        );
        done();
      }
    });

    actor.start();

    actor.send({ type: 'count', value: 42 });
  });
});
