import z from 'zod';
import { createMachine } from '../../index.ts';
import { getShortestPaths } from '../index.ts';

describe('events', () => {
  it('should allow for dynamic generation of cases based on state', () => {
    const values = [1, 2, 3];
    const testMachine = createMachine({
      schemas: {
        context: z.object({
          values: z.array(z.number())
        }),
        events: {
          EVENT: z.object({ value: z.number() })
        }
      },
      initial: 'a',
      context: {
        values // to be read by generator
      },
      states: {
        a: {
          on: {
            EVENT: ({ event }) => {
              if (event.value === 1) {
                return { target: 'b' };
              }
              if (event.value === 2) {
                return { target: 'c' };
              }
              return { target: 'd' };
            }
          }
        },
        b: {},
        c: {},
        d: {}
      }
    });

    const paths = getShortestPaths(testMachine, {
      events: (state) =>
        state.context.values.map((value) => ({ type: 'EVENT', value }) as const)
    });

    expect(
      paths
        .filter((path) => path.steps.length > 1)
        .map((path) => path.steps[1].event)
    ).toMatchInlineSnapshot(`
      [
        {
          "type": "EVENT",
          "value": 1,
        },
        {
          "type": "EVENT",
          "value": 2,
        },
        {
          "type": "EVENT",
          "value": 3,
        },
      ]
    `);
  });
});

describe('state limiting', () => {
  it('should limit states with stopWhen option', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      initial: 'counting',
      context: { count: 0 },
      states: {
        counting: {
          on: {
            INC: ({ context }) => {
              return {
                context: {
                  count: context.count + 1
                }
              };
            }
          }
        }
      }
    });

    const paths = getShortestPaths(machine, {
      stopWhen: (state) => {
        return state.context.count >= 5;
      }
    });

    expect(paths.map((path) => path.state.context.count)).toEqual([
      0, 1, 2, 3, 4, 5
    ]);
  });
});

// https://github.com/statelyai/xstate/issues/1935
it('prevents infinite recursion based on a provided limit', () => {
  const machine = createMachine({
    schemas: {
      context: z.object({
        count: z.number()
      })
    },
    id: 'machine',
    context: {
      count: 0
    },
    on: {
      TOGGLE: ({ context }) => ({
        context: {
          count: context.count + 1
        }
      })
    }
  });

  expect(() => {
    getShortestPaths(machine, { limit: 100 });
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Traversal limit exceeded]`);
});

it('should traverse with input', () => {
  const machine = createMachine({
    schemas: {
      input: z.object({
        name: z.string()
      }),
      context: z.object({
        name: z.string()
      })
    },
    context: (x) => ({
      name: x.input.name
    }),
    initial: 'checking',
    states: {
      checking: {
        always: ({ context }) => {
          if (context.name.length > 3) {
            return { target: 'longName' };
          }
          return { target: 'shortName' };
        }
      },
      longName: {},
      shortName: {}
    }
  });

  const path1 = getShortestPaths(machine, {
    input: { name: 'ed' }
  });

  expect(path1[0].steps.map((s) => s.state.value)).toEqual(['shortName']);

  const path2 = getShortestPaths(machine, {
    input: { name: 'edward' }
  });

  expect(path2[0].steps.map((s) => s.state.value)).toEqual(['longName']);
});
