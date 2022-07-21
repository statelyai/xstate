import {
  Machine,
  StateNode,
  createMachine,
  State,
  EventObject,
  StateValue,
  AnyState
} from 'xstate';
import {
  getStateNodes,
  getPathFromEvents,
  getSimplePlans,
  getShortestPlans,
  toDirectedGraph,
  StatePath,
  StatePlan
} from '../src/index';
import {
  joinPaths,
  traverseShortestPlans,
  traverseSimplePlans
} from '../src/graph';
import { assign } from 'xstate';
import { flatten } from 'xstate/lib/utils';

function getPlansSnapshot(
  plans: Array<StatePlan<any, EventObject>>
): Array<ReturnType<typeof getPathSnapshot>> {
  return flatten(
    plans.map((plan) => {
      return plan.paths.map(getPathSnapshot);
    })
  );
}

function getPathSnapshot(
  path: StatePath<any, any>
): {
  state: StateValue;
  steps: Array<{ state: StateValue; eventType: string }>;
} {
  return {
    state: path.state instanceof State ? path.state.value : path.state,
    steps: path.steps.map((step) => ({
      state: step.state instanceof State ? step.state.value : step.state,
      eventType: step.event.type
    }))
  };
}

describe('@xstate/graph', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: {
            target: 'wait',
            actions: ['startCountdown']
          }
        }
      },
      wait: {
        on: {
          PED_COUNTDOWN: 'stop'
        }
      },
      stop: {},
      flashing: {}
    }
  };

  const lightMachine = Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red.flashing',
          PUSH_BUTTON: [
            {
              actions: ['doNothing'] // pushing the walk button never does anything
            }
          ]
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: '#light.red.flashing'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red.flashing'
        },
        ...pedestrianStates
      }
    }
  });

  interface CondMachineCtx {
    id: string;
  }
  type CondMachineEvents = { type: 'EVENT'; id: string } | { type: 'STATE' };

  const condMachine = createMachine<CondMachineCtx, CondMachineEvents>({
    key: 'cond',
    initial: 'pending',
    states: {
      pending: {
        on: {
          EVENT: [
            {
              target: 'foo',
              cond: (_, e) => e.id === 'foo'
            },
            { target: 'bar' }
          ],
          STATE: [
            {
              target: 'foo',
              cond: (s) => s.id === 'foo'
            },
            { target: 'bar' }
          ]
        }
      },
      foo: {},
      bar: {}
    }
  });

  const parallelMachine = createMachine({
    type: 'parallel',
    key: 'p',
    states: {
      a: {
        initial: 'a1',
        states: {
          a1: {
            on: { 2: 'a2', 3: 'a3' }
          },
          a2: {
            on: { 3: 'a3', 1: 'a1' }
          },
          a3: {}
        }
      },
      b: {
        initial: 'b1',
        states: {
          b1: {
            on: { 2: 'b2', 3: 'b3' }
          },
          b2: {
            on: { 3: 'b3', 1: 'b1' }
          },
          b3: {}
        }
      }
    }
  });

  describe('getStateNodes()', () => {
    it('should return an array of all nodes', () => {
      const nodes = getStateNodes(lightMachine);
      expect(nodes.every((node) => node instanceof StateNode)).toBe(true);
      expect(nodes.map((node) => node.id).sort()).toEqual([
        'light.green',
        'light.red',
        'light.red.flashing',
        'light.red.stop',
        'light.red.wait',
        'light.red.walk',
        'light.yellow'
      ]);
    });

    it('should return an array of all nodes (parallel)', () => {
      const nodes = getStateNodes(parallelMachine);
      expect(nodes.every((node) => node instanceof StateNode)).toBe(true);
      expect(nodes.map((node) => node.id).sort()).toEqual([
        'p.a',
        'p.a.a1',
        'p.a.a2',
        'p.a.a3',
        'p.b',
        'p.b.b1',
        'p.b.b2',
        'p.b.b3'
      ]);
    });
  });

  describe('getShortestPaths()', () => {
    it('should return a mapping of shortest paths to all states', () => {
      const paths = getShortestPlans(lightMachine);

      expect(getPlansSnapshot(paths)).toMatchSnapshot('shortest paths');
    });

    it('should return a mapping of shortest paths to all states (parallel)', () => {
      const paths = getShortestPlans(parallelMachine);
      expect(getPlansSnapshot(paths)).toMatchSnapshot(
        'shortest paths parallel'
      );
    });

    it('the initial state should have a zero-length path', () => {
      const shortestPaths = getShortestPlans(lightMachine);

      expect(
        shortestPaths.find((plan) =>
          plan.state.matches(lightMachine.initialState.value)
        )!.paths[0].steps
      ).toHaveLength(0);
    });

    xit('should not throw when a condition is present', () => {
      expect(() => getShortestPlans(condMachine)).not.toThrow();
    });

    it.skip('should represent conditional paths based on context', () => {
      const machine = createMachine<CondMachineCtx, CondMachineEvents>({
        key: 'cond',
        initial: 'pending',
        context: {
          id: 'foo'
        },
        states: {
          pending: {
            on: {
              EVENT: [
                {
                  target: 'foo',
                  cond: (_, e) => e.id === 'foo'
                },
                { target: 'bar' }
              ],
              STATE: [
                {
                  target: 'foo',
                  cond: (s) => s.id === 'foo'
                },
                { target: 'bar' }
              ]
            }
          },
          foo: {},
          bar: {}
        }
      });

      const paths = getShortestPlans(machine, {
        getEvents: () =>
          [
            {
              type: 'EVENT',
              id: 'whatever'
            },
            {
              type: 'STATE'
            }
          ] as const
      });

      expect(getPlansSnapshot(paths)).toMatchSnapshot(
        'shortest paths conditional'
      );
    });
  });

  describe('getSimplePaths()', () => {
    it('should return a mapping of arrays of simple paths to all states', () => {
      const paths = getSimplePlans(lightMachine);

      expect(paths.map((path) => path.state.value)).toMatchInlineSnapshot(`
        Array [
          "green",
          "yellow",
          Object {
            "red": "flashing",
          },
          Object {
            "red": "walk",
          },
          Object {
            "red": "wait",
          },
          Object {
            "red": "stop",
          },
        ]
      `);

      expect(getPlansSnapshot(paths)).toMatchSnapshot();
    });

    const equivMachine = createMachine({
      initial: 'a',
      states: {
        a: { on: { FOO: 'b', BAR: 'b' } },
        b: { on: { FOO: 'a', BAR: 'a' } }
      }
    });

    it('should return a mapping of simple paths to all states (parallel)', () => {
      const paths = getSimplePlans(parallelMachine);

      expect(paths.map((p) => p.state.value)).toMatchInlineSnapshot(`
        Array [
          Object {
            "a": "a1",
            "b": "b1",
          },
          Object {
            "a": "a2",
            "b": "b2",
          },
          Object {
            "a": "a3",
            "b": "b3",
          },
        ]
      `);
      expect(getPlansSnapshot(paths)).toMatchSnapshot('simple paths parallel');
    });

    it('should return multiple paths for equivalent transitions', () => {
      const paths = getSimplePlans(equivMachine);

      expect(paths.map((p) => p.state.value)).toMatchInlineSnapshot(`
        Array [
          "a",
          "b",
        ]
      `);
      expect(getPlansSnapshot(paths)).toMatchSnapshot(
        'simple paths equal transitions'
      );
    });

    it('should return a single empty path for the initial state', () => {
      expect(
        getSimplePlans(lightMachine).find((p) =>
          p.state.matches(lightMachine.initialState.value)
        )!.paths
      ).toHaveLength(1);
      expect(
        getSimplePlans(lightMachine).find((p) =>
          p.state.matches(lightMachine.initialState.value)
        )!.paths[0].steps
      ).toHaveLength(0);
      expect(
        getSimplePlans(equivMachine).find((p) =>
          p.state.matches(equivMachine.initialState.value)
        )!.paths
      ).toHaveLength(1);
      expect(
        getSimplePlans(equivMachine).find((p) =>
          p.state.matches(equivMachine.initialState.value)
        )!.paths[0].steps
      ).toHaveLength(0);
    });

    it('should return value-based paths', () => {
      interface Ctx {
        count: number;
      }
      interface Events {
        type: 'INC';
        value: number;
      }
      const countMachine = createMachine<Ctx, Events>({
        id: 'count',
        initial: 'start',
        context: {
          count: 0
        },
        states: {
          start: {
            always: {
              target: 'finish',
              cond: (ctx) => ctx.count === 3
            },
            on: {
              INC: {
                actions: assign({
                  count: (ctx) => ctx.count + 1
                })
              }
            }
          },
          finish: {}
        }
      });

      const paths = getSimplePlans(countMachine, {
        getEvents: () => [{ type: 'INC', value: 1 }] as const
      });

      expect(paths.map((p) => p.state.value)).toMatchInlineSnapshot(`
        Array [
          "start",
          "start",
          "start",
          "finish",
        ]
      `);
      expect(getPlansSnapshot(paths)).toMatchSnapshot('simple paths context');
    });
  });

  describe('getPathFromEvents()', () => {
    it('should return a path to the last entered state by the event sequence', () => {
      const path = getPathFromEvents(lightMachine, [
        { type: 'TIMER' },
        { type: 'TIMER' },
        { type: 'TIMER' },
        { type: 'POWER_OUTAGE' }
      ]);

      expect(getPathSnapshot(path)).toMatchSnapshot('path from events');
    });

    it.skip('should throw when an invalid event sequence is provided', () => {
      expect(() =>
        getPathFromEvents(lightMachine, [
          { type: 'TIMER' },
          { type: 'INVALID_EVENT' }
        ])
      ).toThrow();
    });

    it('should return a path from a specified initial state', () => {
      const path = getPathFromEvents(lightMachine, [{ type: 'TIMER' }], {
        initialState: lightMachine.resolveState(State.from('yellow'))
      });

      // TODO: types work fine in test file, but not when running test!
      expect((path as any).state.matches('red')).toBeTruthy();
    });
  });

  describe('toDirectedGraph', () => {
    it('should represent a statechart as a directed graph', () => {
      const machine = createMachine({
        id: 'light',
        initial: 'green',
        states: {
          green: { on: { TIMER: 'yellow' } },
          yellow: { on: { TIMER: 'red' } },
          red: {
            initial: 'walk',
            states: {
              walk: { on: { COUNTDOWN: 'wait' } },
              wait: { on: { COUNTDOWN: 'stop' } },
              stop: { on: { COUNTDOWN: 'finished' } },
              finished: { type: 'final' }
            },
            onDone: 'green'
          }
        }
      });

      const digraph = toDirectedGraph(machine);

      expect(digraph).toMatchSnapshot();
    });
  });
});

it('simple paths for reducers', () => {
  const a = traverseShortestPlans(
    {
      transition: (s, e) => {
        if (e.type === 'a') {
          return 1;
        }
        if (e.type === 'b' && s === 1) {
          return 2;
        }
        if (e.type === 'reset') {
          return 0;
        }
        return s;
      },
      initialState: 0
    },
    {
      getEvents: () => [{ type: 'a' }, { type: 'b' }, { type: 'reset' }],
      serializeState: (v, e) => JSON.stringify(v) + ' | ' + JSON.stringify(e)
    }
  );

  expect(getPlansSnapshot(a)).toMatchSnapshot();
});

it('shortest paths for reducers', () => {
  const a = traverseSimplePlans(
    {
      transition: (s, e) => {
        if (e.type === 'a') {
          return 1;
        }
        if (e.type === 'b' && s === 1) {
          return 2;
        }
        if (e.type === 'reset') {
          return 0;
        }
        return s;
      },
      initialState: 0 as number
    },
    {
      getEvents: () => [{ type: 'a' }, { type: 'b' }, { type: 'reset' }],
      serializeState: (v, e) => JSON.stringify(v) + ' | ' + JSON.stringify(e)
    }
  );

  expect(getPlansSnapshot(a)).toMatchSnapshot();
});

describe('filtering', () => {
  it('should not traverse past filtered states', () => {
    const machine = createMachine<{ count: number }>({
      initial: 'counting',
      context: { count: 0 },
      states: {
        counting: {
          on: {
            INC: {
              actions: assign({
                count: (ctx) => ctx.count + 1
              })
            }
          }
        }
      }
    });

    const sp = getShortestPlans(machine, {
      getEvents: () => [{ type: 'INC' }],
      filter: (s) => s.context.count < 5
    });

    expect(sp.map((p) => p.state.context)).toMatchInlineSnapshot(`
      Array [
        Object {
          "count": 0,
        },
        Object {
          "count": 1,
        },
        Object {
          "count": 2,
        },
        Object {
          "count": 3,
        },
        Object {
          "count": 4,
        },
      ]
    `);
  });
});

it('should provide previous state for serializeState()', () => {
  const machine = createMachine({
    initial: 'a',
    states: {
      a: {
        on: { toB: 'b' }
      },
      b: {
        on: { toC: 'c' }
      },
      c: {
        on: { toA: 'a' }
      }
    }
  });

  const shortestPaths = getShortestPlans(machine, {
    serializeState: (state, event, prevState) => {
      return `${JSON.stringify(state.value)} via ${event?.type}${
        prevState ? ` via ${JSON.stringify(prevState.value)}` : ''
      }`;
    }
  });

  // Should be [0, 3]:
  // 0 (a)
  // 3 (a -> b -> c -> a)
  expect(
    shortestPaths
      .filter((path) => path.state.matches('a'))
      .map((plan) => plan.paths[0].steps.length)
  ).toEqual([0, 3]);
});

it.each([getShortestPlans, getSimplePlans])(
  'initial state can be specified',
  (getPlans) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { toB: 'b' }
        },
        b: {
          on: { toC: 'c' }
        },
        c: {
          on: { toA: 'a' }
        }
      }
    });

    const plans = getPlans(machine, {
      initialState: machine.resolveState(State.from('b'))
    });

    // Instead of taking 1 step to reach state 'b', there should
    // exist a path that takes 0 steps
    expect(
      plans
        .find((plan) => plan.state.matches('b'))
        ?.paths.find((path) => path.steps.length === 0)
    ).toBeTruthy();

    // Instead of starting at state 'a', it should take > 0 steps to reach 'a'
    expect(
      plans
        .find((plan) => plan.state.matches('a'))
        ?.paths.every((path) => path.steps.length > 0)
    ).toBeTruthy();
  }
);

describe('joinPaths()', () => {
  it('should join two paths', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          on: {
            TO_C: 'c'
          }
        },
        c: {}
      }
    });

    const pathToB = getPathFromEvents(machine, [{ type: 'NEXT' }]);
    const pathToC = getPathFromEvents(machine, [{ type: 'TO_C' }], {
      initialState: pathToB.state
    });
    const pathToBAndC = joinPaths(pathToB, pathToC);

    expect(pathToBAndC.steps.map((step) => step.event.type))
      .toMatchInlineSnapshot(`
      Array [
        "NEXT",
        "TO_C",
      ]
    `);

    // TODO: figure out why TS is complaining only in the test
    expect((pathToBAndC.state as AnyState)!.matches('c')).toBeTruthy();
  });

  it('should not join two paths with mismatched source/target states', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          on: {
            TO_C: 'c'
          }
        },
        c: {}
      }
    });

    const pathToB = getPathFromEvents(machine, [{ type: 'NEXT' }]);
    const pathToCFromA = getPathFromEvents(machine, [{ type: 'TO_C' }]);

    expect(() => {
      joinPaths(pathToB, pathToCFromA);
    }).toThrowError(/Paths cannot be joined/);
  });
});
