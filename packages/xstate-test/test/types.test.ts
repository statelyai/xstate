import { createMachine } from 'xstate';
import { createTestModel } from '../src/index.ts';

describe('types', () => {
  it('`EventExecutor` should be passed event with type that corresponds to its key', () => {
    const machine = createMachine({
      id: 'test',
      types: {
        events: {} as
          | { type: 'a'; valueA: boolean }
          | { type: 'b'; valueB: number }
      },
      initial: 'a',
      states: {
        a: {
          on: {
            a: { target: '#test.b' }
          }
        },
        b: {
          on: {
            b: { target: '#test.a' }
          }
        }
      }
    });

    for (const path of createTestModel(machine).getShortestPaths()) {
      path.test({
        events: {
          a: ({ event }) => {
            ((_accept: 'a') => {})(event.type);
            // @ts-expect-error
            ((_accept: 'b') => {})(event.type);
          },
          b: ({ event }) => {
            // @ts-expect-error
            ((_accept: 'a') => {})(event.type);
            ((_accept: 'b') => {})(event.type);
          }
        }
      });
    }
  });
});
