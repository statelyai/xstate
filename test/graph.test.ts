import { assert } from 'chai';
import { Machine, StateNode } from '../src/index';
import {
  getNodes,
  getEdges,
  getShortestPaths,
  getSimplePaths,
  getAdjacencyMap,
  getShortestPathsAsArray,
  getSimplePathsAsArray,
  ValueAdjacency
} from '../src/graph';
import { PathMap } from '../src/types';
import { assign } from '../src/actions';
// tslint:disable-next-line:no-var-requires
// import * as util from 'util';

describe('graph utilities', () => {
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

  const condMachine = Machine<
    { id: string },
    any,
    { type: 'EVENT'; id: string } | { type: 'STATE' }
  >({
    key: 'cond',
    initial: 'pending',
    states: {
      pending: {
        on: {
          EVENT: [
            { target: 'foo', cond: (_, e) => e.id === 'foo' },
            { target: 'bar' }
          ],
          STATE: [
            { target: 'foo', cond: s => s.id === 'foo' },
            { target: 'bar' }
          ]
        }
      },
      foo: {},
      bar: {}
    }
  });

  const parallelMachine = Machine({
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

  describe('getNodes()', () => {
    it('should return an array of all nodes', () => {
      const nodes = getNodes(lightMachine);
      assert.ok(nodes.every(node => node instanceof StateNode));
      assert.sameMembers(nodes.map(node => node.id), [
        'light.green',
        'light.yellow',
        'light.red',
        'light.red.walk',
        'light.red.wait',
        'light.red.stop',
        'light.red.flashing'
      ]);
    });

    it('should return an array of all nodes (parallel)', () => {
      const nodes = getNodes(parallelMachine);
      assert.ok(nodes.every(node => node instanceof StateNode));
      assert.sameMembers(nodes.map(node => node.id), [
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

  describe('getEdges()', () => {
    it('should return an array of all directed edges', () => {
      const edges = getEdges(lightMachine);
      assert.ok(
        edges.every(edge => {
          return (
            typeof edge.event === 'string' &&
            edge.source instanceof StateNode &&
            edge.target instanceof StateNode
          );
        })
      );
      assert.sameDeepMembers(
        edges.map(edge => ({
          event: edge.event,
          source: edge.source.id,
          target: edge.target.id,
          actions: edge.actions
        })),
        [
          {
            event: 'PUSH_BUTTON',
            source: 'light.green',
            target: 'light.green',
            actions: ['doNothing'] // lol
          },
          {
            event: 'TIMER',
            source: 'light.green',
            target: 'light.yellow',
            actions: []
          },
          {
            event: 'TIMER',
            source: 'light.yellow',
            target: 'light.red',
            actions: []
          },
          {
            event: 'PED_COUNTDOWN',
            source: 'light.red.walk',
            target: 'light.red.wait',
            actions: ['startCountdown']
          },
          {
            event: 'PED_COUNTDOWN',
            source: 'light.red.wait',
            target: 'light.red.stop',
            actions: []
          },
          {
            event: 'TIMER',
            source: 'light.red',
            target: 'light.green',
            actions: []
          },
          {
            event: 'POWER_OUTAGE',
            source: 'light.red',
            target: 'light.red.flashing',
            actions: []
          },
          {
            event: 'POWER_OUTAGE',
            source: 'light.yellow',
            target: 'light.red.flashing',
            actions: []
          },
          {
            event: 'POWER_OUTAGE',
            source: 'light.green',
            target: 'light.red.flashing',
            actions: []
          }
        ]
      );
    });

    it('should return an array of all directed edges (parallel)', () => {
      const edges = getEdges(parallelMachine);
      assert.ok(
        edges.every(edge => {
          return (
            typeof edge.event === 'string' &&
            edge.source instanceof StateNode &&
            edge.target instanceof StateNode
          );
        })
      );
      assert.sameDeepMembers(
        edges.map(edge => ({
          event: edge.event,
          source: edge.source.id,
          target: edge.target.id
        })),
        [
          { event: '2', source: 'p.a.a1', target: 'p.a.a2' },
          { event: '1', source: 'p.a.a2', target: 'p.a.a1' },
          { event: '3', source: 'p.a.a2', target: 'p.a.a3' },
          { event: '3', source: 'p.a.a1', target: 'p.a.a3' },
          { event: '2', source: 'p.b.b1', target: 'p.b.b2' },
          { event: '1', source: 'p.b.b2', target: 'p.b.b1' },
          { event: '3', source: 'p.b.b2', target: 'p.b.b3' },
          { event: '3', source: 'p.b.b1', target: 'p.b.b3' }
        ]
      );
    });
  });

  describe('getAdjacencyMap()', () => {
    it('should return a flattened adjacency map', () => {
      assert.deepEqual(getAdjacencyMap(lightMachine), {
        '"green"': {
          TIMER: { state: 'yellow' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: 'green' },
          PUSH_BUTTON: { state: 'green' }
        },
        '"yellow"': {
          TIMER: { state: { red: 'walk' } },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: 'yellow' },
          PUSH_BUTTON: { state: 'yellow' }
        },
        '{"red":"walk"}': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: { red: 'wait' } },
          PUSH_BUTTON: { state: { red: 'walk' } }
        },
        '{"red":"flashing"}': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: { red: 'flashing' } },
          PUSH_BUTTON: { state: { red: 'flashing' } }
        },
        '{"red":"wait"}': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: { red: 'stop' } },
          PUSH_BUTTON: { state: { red: 'wait' } }
        },
        '{"red":"stop"}': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: { red: 'stop' } },
          PUSH_BUTTON: { state: { red: 'stop' } }
        }
      });
    });

    it('should return a flattened adjacency map (parallel)', () => {
      assert.deepEqual(getAdjacencyMap(parallelMachine), {
        '{"a":"a1","b":"b1"}': {
          '1': { state: { a: 'a1', b: 'b1' } },
          '2': { state: { a: 'a2', b: 'b2' } },
          '3': { state: { a: 'a3', b: 'b3' } }
        },
        '{"a":"a2","b":"b2"}': {
          '1': { state: { a: 'a1', b: 'b1' } },
          '2': { state: { a: 'a2', b: 'b2' } },
          '3': { state: { a: 'a3', b: 'b3' } }
        },
        '{"a":"a3","b":"b3"}': {
          '1': { state: { a: 'a3', b: 'b3' } },
          '2': { state: { a: 'a3', b: 'b3' } },
          '3': { state: { a: 'a3', b: 'b3' } }
        }
      });
    });
  });

  describe('getShortestPaths()', () => {
    it('should return a mapping of shortest paths to all states', () => {
      assert.deepEqual(getShortestPaths(lightMachine), {
        '"green"': [],
        '"yellow"': [
          {
            state: { context: undefined, value: 'green' },
            event: { type: 'TIMER' }
          }
        ],
        '{"red":"flashing"}': [
          {
            state: { context: undefined, value: 'green' },
            event: { type: 'POWER_OUTAGE' }
          }
        ],
        '{"red":"walk"}': [
          {
            state: { context: undefined, value: 'green' },
            event: { type: 'TIMER' }
          },
          {
            state: { context: undefined, value: 'yellow' },
            event: { type: 'TIMER' }
          }
        ],
        '{"red":"wait"}': [
          {
            state: { context: undefined, value: 'green' },
            event: { type: 'TIMER' }
          },
          {
            state: { context: undefined, value: 'yellow' },
            event: { type: 'TIMER' }
          },
          {
            state: { context: undefined, value: { red: 'walk' } },
            event: { type: 'PED_COUNTDOWN' }
          }
        ],
        '{"red":"stop"}': [
          {
            state: { context: undefined, value: 'green' },
            event: { type: 'TIMER' }
          },
          {
            state: { context: undefined, value: 'yellow' },
            event: { type: 'TIMER' }
          },
          {
            state: { context: undefined, value: { red: 'walk' } },
            event: { type: 'PED_COUNTDOWN' }
          },
          {
            state: { context: undefined, value: { red: 'wait' } },
            event: { type: 'PED_COUNTDOWN' }
          }
        ]
      });
    });

    it('should return a mapping of shortest paths to all states (parallel)', () => {
      assert.deepEqual(getShortestPaths(parallelMachine), {
        '{"a":"a1","b":"b1"}': [],
        '{"a":"a2","b":"b2"}': [
          {
            event: { type: '2' },
            state: {
              context: undefined,
              value: {
                a: 'a1',
                b: 'b1'
              }
            }
          }
        ],
        '{"a":"a3","b":"b3"}': [
          {
            event: { type: '3' },
            state: {
              context: undefined,
              value: {
                a: 'a1',
                b: 'b1'
              }
            }
          }
        ]
      });
    });

    it('the initial state should have a zero-length path', () => {
      assert.lengthOf(
        (getShortestPaths(lightMachine) as PathMap)[
          JSON.stringify(lightMachine.initialState.value)
        ],
        0
      );
    });

    it('should not throw when a condition is present', () => {
      assert.doesNotThrow(() => getShortestPaths(condMachine));
    });

    it('should represent conditional paths based on context', () => {
      assert.deepEqual(getShortestPaths(condMachine, { id: 'foo' }), {
        '"bar"': [
          {
            event: { type: 'EVENT' },
            state: { context: undefined, value: 'pending' }
          }
        ],
        '"foo"': [
          {
            event: { type: 'STATE' },
            state: { context: undefined, value: 'pending' }
          }
        ],
        '"pending"': []
      });
    });
  });

  describe('getShortestPathsAsArray()', () => {
    it('should return an array of shortest paths to all states', () => {
      assert.deepEqual(getShortestPathsAsArray(lightMachine), [
        { state: 'green', path: [] },
        {
          state: 'yellow',
          path: [
            {
              state: { context: undefined, value: 'green' },
              event: { type: 'TIMER' }
            }
          ]
        },
        {
          state: { red: 'flashing' },
          path: [
            {
              state: { context: undefined, value: 'green' },
              event: { type: 'POWER_OUTAGE' }
            }
          ]
        },
        {
          state: { red: 'walk' },
          path: [
            {
              state: { context: undefined, value: 'green' },
              event: { type: 'TIMER' }
            },
            {
              state: { context: undefined, value: 'yellow' },
              event: { type: 'TIMER' }
            }
          ]
        },
        {
          state: { red: 'wait' },
          path: [
            {
              state: { context: undefined, value: 'green' },
              event: { type: 'TIMER' }
            },
            {
              state: { context: undefined, value: 'yellow' },
              event: { type: 'TIMER' }
            },
            {
              state: { context: undefined, value: { red: 'walk' } },
              event: { type: 'PED_COUNTDOWN' }
            }
          ]
        },
        {
          state: { red: 'stop' },
          path: [
            {
              state: { context: undefined, value: 'green' },
              event: { type: 'TIMER' }
            },
            {
              state: { context: undefined, value: 'yellow' },
              event: { type: 'TIMER' }
            },
            {
              state: { context: undefined, value: { red: 'walk' } },
              event: { type: 'PED_COUNTDOWN' }
            },
            {
              state: { context: undefined, value: { red: 'wait' } },
              event: { type: 'PED_COUNTDOWN' }
            }
          ]
        }
      ]);
    });
  });

  describe('getSimplePaths()', () => {
    it('should return a mapping of arrays of simple paths to all states', () => {
      assert.deepEqual(getSimplePaths(lightMachine), {
        '"green"': [[]],
        '"yellow"': [
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            }
          ]
        ],
        '{"red":"walk"}': [
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'TIMER' }
            }
          ]
        ],
        '{"red":"wait"}': [
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: { red: 'walk' }, context: undefined },
              event: { type: 'PED_COUNTDOWN' }
            }
          ]
        ],
        '{"red":"stop"}': [
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: { red: 'walk' }, context: undefined },
              event: { type: 'PED_COUNTDOWN' }
            },
            {
              state: { value: { red: 'wait' }, context: undefined },
              event: { type: 'PED_COUNTDOWN' }
            }
          ]
        ],
        '{"red":"flashing"}': [
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: { red: 'walk' }, context: undefined },
              event: { type: 'PED_COUNTDOWN' }
            },
            {
              state: { value: { red: 'wait' }, context: undefined },
              event: { type: 'PED_COUNTDOWN' }
            },
            {
              state: { value: { red: 'stop' }, context: undefined },
              event: { type: 'POWER_OUTAGE' }
            }
          ],
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: { red: 'walk' }, context: undefined },
              event: { type: 'PED_COUNTDOWN' }
            },
            {
              state: { value: { red: 'wait' }, context: undefined },
              event: { type: 'POWER_OUTAGE' }
            }
          ],
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: { red: 'walk' }, context: undefined },
              event: { type: 'POWER_OUTAGE' }
            }
          ],
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'TIMER' }
            },
            {
              state: { value: 'yellow', context: undefined },
              event: { type: 'POWER_OUTAGE' }
            }
          ],
          [
            {
              state: { value: 'green', context: undefined },
              event: { type: 'POWER_OUTAGE' }
            }
          ]
        ]
      });
    });

    const equivMachine = Machine({
      initial: 'a',
      states: {
        a: { on: { FOO: 'b', BAR: 'b' } },
        b: { on: { FOO: 'a', BAR: 'a' } }
      }
    });

    it('should return a mapping of simple paths to all states (parallel)', () => {
      assert.deepEqual(getSimplePaths(parallelMachine), {
        '{"a":"a1","b":"b1"}': [[]],
        '{"a":"a2","b":"b2"}': [
          [
            {
              event: { type: '2' },
              state: {
                context: undefined,
                value: {
                  a: 'a1',
                  b: 'b1'
                }
              }
            }
          ]
        ],
        '{"a":"a3","b":"b3"}': [
          [
            {
              event: { type: '2' },
              state: {
                context: undefined,
                value: {
                  a: 'a1',
                  b: 'b1'
                }
              }
            },
            {
              event: { type: '3' },
              state: {
                context: undefined,
                value: {
                  a: 'a2',
                  b: 'b2'
                }
              }
            }
          ],
          [
            {
              event: { type: '3' },
              state: {
                context: undefined,
                value: {
                  a: 'a1',
                  b: 'b1'
                }
              }
            }
          ]
        ]
      });
    });

    it('should return multiple paths for equivalent transitions', () => {
      assert.deepEqual(getSimplePaths(equivMachine), {
        '"a"': [[]],
        '"b"': [
          [
            {
              event: { type: 'FOO' },
              state: { context: undefined, value: 'a' }
            }
          ],
          [
            {
              event: { type: 'BAR' },
              state: { context: undefined, value: 'a' }
            }
          ]
        ]
      });
    });

    it('should return a single empty path for the initial state', () => {
      assert.deepEqual(getSimplePaths(lightMachine)['"green"'], [[]]);
      assert.deepEqual(getSimplePaths(equivMachine)['"a"'], [[]]);
    });
  });

  describe('getSimplePathsAsArray()', () => {
    it('should return an array of shortest paths to all states', () => {
      assert.deepEqual(getSimplePathsAsArray(lightMachine), [
        { state: 'green', paths: [[]] },
        {
          state: 'yellow',
          paths: [
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              }
            ]
          ]
        },
        {
          state: { red: 'walk' },
          paths: [
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'TIMER' }
              }
            ]
          ]
        },
        {
          state: { red: 'wait' },
          paths: [
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: { red: 'walk' }, context: undefined },
                event: { type: 'PED_COUNTDOWN' }
              }
            ]
          ]
        },
        {
          state: { red: 'stop' },
          paths: [
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: { red: 'walk' }, context: undefined },
                event: { type: 'PED_COUNTDOWN' }
              },
              {
                state: { value: { red: 'wait' }, context: undefined },
                event: { type: 'PED_COUNTDOWN' }
              }
            ]
          ]
        },
        {
          state: { red: 'flashing' },
          paths: [
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: { red: 'walk' }, context: undefined },
                event: { type: 'PED_COUNTDOWN' }
              },
              {
                state: { value: { red: 'wait' }, context: undefined },
                event: { type: 'PED_COUNTDOWN' }
              },
              {
                state: { value: { red: 'stop' }, context: undefined },
                event: { type: 'POWER_OUTAGE' }
              }
            ],
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: { red: 'walk' }, context: undefined },
                event: { type: 'PED_COUNTDOWN' }
              },
              {
                state: { value: { red: 'wait' }, context: undefined },
                event: { type: 'POWER_OUTAGE' }
              }
            ],
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: { red: 'walk' }, context: undefined },
                event: { type: 'POWER_OUTAGE' }
              }
            ],
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'TIMER' }
              },
              {
                state: { value: 'yellow', context: undefined },
                event: { type: 'POWER_OUTAGE' }
              }
            ],
            [
              {
                state: { value: 'green', context: undefined },
                event: { type: 'POWER_OUTAGE' }
              }
            ]
          ]
        }
      ]);
    });
  });

  describe('valueAdjacencyMap', () => {
    it('should map adjacencies', () => {
      const counterMachine = Machine({
        id: 'counter',
        initial: 'empty',
        context: { count: 0 },
        states: {
          empty: {
            on: {
              '': {
                target: 'full',
                cond: ctx => ctx.count === 5
              },
              INC: {
                actions: assign({ count: (ctx, e) => ctx.count + e.value })
              },
              DEC: { actions: assign({ count: ctx => ctx.count - 1 }) }
            }
          },
          full: {}
        }
      });

      const adjacency = new ValueAdjacency(counterMachine, {
        filter: state => state.context.count >= 0 && state.context.count <= 5,
        events: {
          INC: [{ type: 'INC', value: 1 }]
        }
      });

      assert.ok(adjacency.reaches('full', { count: 5 }));
    });
  });
});
