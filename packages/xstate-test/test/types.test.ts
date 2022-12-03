import { createMachine } from 'xstate';
import { createTestModel } from '../src';

describe('types', () => {
  it('`EventExecutor` should be passed event with type that corresponds to its key', () => {
    const machine = createMachine({
      id: 'test',
      schema: {
        context: {} as any,
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
            console.log(event.valueA);
          },
          b: ({ event }) => {
            console.log(event.valueB);
          }
        }
      });
    }
  });
});
