import { createActor, createMachine, assertEvent } from '../src';

describe('assertion helpers', () => {
  it('assertEvent asserts the correct event type', (done) => {
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
      types: {
        events: {} as TestEvent
      },
      on: {
        greet: {
          fn: ({ event }, enq) => {
            enq.action(() => greet(event));
          }
        },
        count: {
          fn: ({ event }) => {
            greet(event);
          }
        }
      }
    });

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

  it('assertEvent asserts multiple event types', (done) => {
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
      types: {
        events: {} as TestEvent
      },
      on: {
        greet: {
          fn: ({ event }, enq) => {
            enq.action(() => greet(event));
          }
        },
        count: {
          fn: ({ event }, enq) => {
            enq.action(() => greet(event));
          }
        }
      }
    });

    const actor = createActor(machine);

    actor.subscribe({
      error(err) {
        expect(err).toMatchInlineSnapshot(
          `[Error: Expected event {"type":"count","value":42} to have one of types "greet", "notify"]`
        );
        done();
      }
    });

    actor.start();

    actor.send({ type: 'count', value: 42 });
  });
});
