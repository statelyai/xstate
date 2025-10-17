import z from 'zod';
import { next_createMachine } from '../../index.ts';
import { createTestModel } from '../index.ts';
import { testUtils } from './testUtils.ts';

describe('events', () => {
  it('should allow for representing many cases', async () => {
    const feedbackMachine = next_createMachine({
      id: 'feedback',
      // types: {
      //   events: {} as Events
      // },
      schemas: {
        events: z.union([
          z.object({ type: z.literal('CLICK_BAD') }),
          z.object({ type: z.literal('CLICK_GOOD') }),
          z.object({
            type: z.literal('SUBMIT'),
            value: z.string()
          }),
          z.object({ type: z.literal('CLOSE') }),
          z.object({ type: z.literal('ESC') })
        ])
      },
      initial: 'question',
      states: {
        question: {
          on: {
            CLICK_GOOD: 'thanks',
            CLICK_BAD: 'form',
            CLOSE: 'closed',
            ESC: 'closed'
          }
        },
        form: {
          on: {
            // SUBMIT: [
            //   {
            //     target: 'thanks',
            //     guard: ({ event }) => !!event.value.length
            //   },
            //   {
            //     target: '.invalid'
            //   }
            // ],
            SUBMIT: ({ event }) => {
              if (event.value.length > 0) {
                return { target: 'thanks' };
              }
              return { target: '.invalid' };
            },
            CLOSE: 'closed',
            ESC: 'closed'
          },
          initial: 'valid',
          states: {
            valid: {},
            invalid: {}
          }
        },
        thanks: {
          on: {
            CLOSE: 'closed',
            ESC: 'closed'
          }
        },
        closed: {
          type: 'final'
        }
      }
    });

    const testModel = createTestModel(feedbackMachine, {
      events: [
        { type: 'SUBMIT', value: 'something' },
        { type: 'SUBMIT', value: '' }
      ]
    });

    await testUtils.testModel(testModel, {});
  });

  it('should not throw an error for unimplemented events', () => {
    const testMachine = next_createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { ACTIVATE: 'active' }
        },
        active: {}
      }
    });

    const testModel = createTestModel(testMachine);

    expect(async () => {
      await testUtils.testModel(testModel, {});
    }).not.toThrow();
  });

  it('should allow for dynamic generation of cases based on state', async () => {
    const values = [1, 2, 3];
    const testMachine = next_createMachine({
      // types: {} as {
      //   context: { values: number[] };
      //   events: { type: 'EVENT'; value: number };
      // },
      schemas: {
        context: z.object({
          values: z.array(z.number())
        }),
        events: z.object({
          type: z.literal('EVENT'),
          value: z.number()
        })
      },
      initial: 'a',
      context: {
        values // to be read by generator
      },
      states: {
        a: {
          on: {
            // EVENT: [
            //   { guard: ({ event }) => event.value === 1, target: 'b' },
            //   { guard: ({ event }) => event.value === 2, target: 'c' },
            //   { guard: ({ event }) => event.value === 3, target: 'd' }
            // ]
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

    const testedEvents: any[] = [];

    const testModel = createTestModel(testMachine, {
      events: (state) =>
        state.context.values.map((value) => ({ type: 'EVENT', value }) as const)
    });

    const paths = testModel.getShortestPaths();

    expect(paths.length).toBe(3);

    await testUtils.testPaths(paths, {
      events: {
        EVENT: ({ event }) => {
          testedEvents.push(event);
        }
      }
    });

    expect(testedEvents).toMatchInlineSnapshot(`
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
  it('should limit states with filter option', () => {
    const machine = next_createMachine({
      // types: {} as { context: { count: number } },
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

    const testModel = createTestModel(machine);

    const testPaths = testModel.getShortestPaths({
      stopWhen: (state) => {
        return state.context.count >= 5;
      }
    });

    expect(testPaths).toHaveLength(1);
  });
});

// https://github.com/statelyai/xstate/issues/1935
it('prevents infinite recursion based on a provided limit', () => {
  const machine = next_createMachine({
    // types: {} as { context: { count: number } },
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

  const model = createTestModel(machine);

  expect(() => {
    model.getShortestPaths({ limit: 100 });
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Traversal limit exceeded]`);
});

describe('test model options', () => {
  it('options.testState(...) should test state', async () => {
    const testedStates: any[] = [];

    const model = createTestModel(
      next_createMachine({
        initial: 'inactive',
        states: {
          inactive: {
            on: {
              NEXT: 'active'
            }
          },
          active: {}
        }
      })
    );

    await testUtils.testModel(model, {
      states: {
        '*': (state) => {
          testedStates.push(state.value);
        }
      }
    });

    expect(testedStates).toEqual(['inactive', 'active']);
  });
});

// https://github.com/statelyai/xstate/issues/1538
it('tests transitions', async () => {
  expect.assertions(2);
  const machine = next_createMachine({
    initial: 'first',
    states: {
      first: {
        on: { NEXT: 'second' }
      },
      second: {}
    }
  });

  const model = createTestModel(machine);

  const paths = model.getShortestPaths({
    toState: (state) => state.matches('second')
  });

  await paths[0].test({
    events: {
      NEXT: (step) => {
        expect(step).toHaveProperty('event');
        expect(step).toHaveProperty('state');
      }
    }
  });
});

// https://github.com/statelyai/xstate/issues/982
it('Event in event executor should contain payload from case', async () => {
  const machine = next_createMachine({
    initial: 'first',
    states: {
      first: {
        on: { NEXT: 'second' }
      },
      second: {}
    }
  });

  const obj = {};

  const nonSerializableData = () => 42;

  const model = createTestModel(machine, {
    events: [{ type: 'NEXT', payload: 10, fn: nonSerializableData }]
  });

  const paths = model.getShortestPaths({
    toState: (state) => state.matches('second')
  });

  await model.testPath(
    paths[0],
    {
      events: {
        NEXT: (step) => {
          expect(step.event).toEqual({
            type: 'NEXT',
            payload: 10,
            fn: nonSerializableData
          });
        }
      }
    },
    obj
  );
});

describe('state tests', () => {
  it('should test states', async () => {
    // a (1)
    // a -> b (2)
    expect.assertions(2);

    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {}
      }
    });

    const model = createTestModel(machine);

    await testUtils.testModel(model, {
      states: {
        a: (state) => {
          expect(state.value).toEqual('a');
        },
        b: (state) => {
          expect(state.value).toEqual('b');
        }
      }
    });
  });

  it('should test wildcard state for non-matching states', async () => {
    // a (1)
    // a -> b (2)
    // a -> c (2)
    expect.assertions(4);

    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b', OTHER: 'c' }
        },
        b: {},
        c: {}
      }
    });

    const model = createTestModel(machine);

    await testUtils.testModel(model, {
      states: {
        a: (state) => {
          expect(state.value).toEqual('a');
        },
        b: (state) => {
          expect(state.value).toEqual('b');
        },
        '*': (state) => {
          expect(state.value).toEqual('c');
        }
      }
    });
  });

  it('should test nested states', async () => {
    const testedStateValues: any[] = [];

    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          initial: 'b1',
          states: {
            b1: {}
          }
        }
      }
    });

    const model = createTestModel(machine);

    await testUtils.testModel(model, {
      states: {
        a: (state) => {
          testedStateValues.push('a');
          expect(state.value).toEqual('a');
        },
        b: (state) => {
          testedStateValues.push('b');
          expect(state.matches('b')).toBe(true);
        },
        'b.b1': (state) => {
          testedStateValues.push('b.b1');
          expect(state.value).toEqual({ b: 'b1' });
        }
      }
    });
    expect(testedStateValues).toMatchInlineSnapshot(`
      [
        "a",
        "b",
        "b.b1",
      ]
    `);
  });

  it('should test with input', () => {
    const machine = next_createMachine({
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
          // always: [
          //   { guard: (x) => x.context.name.length > 3, target: 'longName' },
          //   { target: 'shortName' }
          // ]
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

    const model = createTestModel(machine);

    const path1 = model.getShortestPaths({
      input: { name: 'ed' }
    });

    expect(path1[0].steps.map((s) => s.state.value)).toEqual(['shortName']);

    const path2 = model.getShortestPaths({
      input: { name: 'edward' }
    });

    expect(path2[0].steps.map((s) => s.state.value)).toEqual(['longName']);
  });
});
