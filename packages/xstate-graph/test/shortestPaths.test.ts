import { assign, createMachine } from 'xstate';
import { getShortestPlansTo } from '../src';
import { machineToBehavior } from '../src/shortestPaths';

describe('getShortestPlansTo', () => {
  it('finds the shortest plans to a state without continuing traversal from that state', () => {
    const m = createMachine<{ count: number }>({
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {
          on: {
            NEXT: 'd'
          }
        },
        d: {
          // If we reach this state, this will cause an infinite loop
          // if the stop condition does not stop the algorithm
          on: {
            NEXT: {
              target: 'd',
              actions: assign({
                count: (ctx) => ctx.count + 1
              })
            }
          }
        }
      }
    });

    const p = getShortestPlansTo(machineToBehavior(m), (state) =>
      state.matches('c')
    );

    expect(
      p.map((plan) => {
        return [plan.state.value, plan.paths.length];
      })
    ).toMatchInlineSnapshot(`
      Array [
        Array [
          "c",
          1,
        ],
      ]
    `);
  });
});
