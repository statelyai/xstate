import { assert } from 'chai';
import { Machine, StateNode } from '../src/index';
import {
  getNodes,
  getEdges,
  getAdjacencyMap,
  getShortestPaths,
  IPathMap,
  getSimplePaths
} from '../src/graph';
// tslint:disable-next-line:no-var-requires
// import * as util from 'util';

describe('graph utilities', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: 'wait'
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
          POWER_OUTAGE: 'red.flashing'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red.flashing'
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
  });

  describe('getEdges()', () => {
    it('should return an array of all directed edges', () => {
      const edges = getEdges(lightMachine);
      edges.every(edge => {
        return (
          typeof edge.event === 'string' &&
          edge.source instanceof StateNode &&
          edge.target instanceof StateNode
        );
      });
      assert.deepEqual(
        edges.map(edge => ({
          event: edge.event,
          source: edge.source.id,
          target: edge.target.id
        })),
        [
          { event: 'TIMER', source: 'light.green', target: 'light.yellow' },
          { event: 'TIMER', source: 'light.yellow', target: 'light.red' },
          {
            event: 'PED_COUNTDOWN',
            source: 'light.red.walk',
            target: 'light.red.wait'
          },
          {
            event: 'PED_COUNTDOWN',
            source: 'light.red.wait',
            target: 'light.red.stop'
          },
          { event: 'TIMER', source: 'light.red', target: 'light.green' },
          {
            event: 'POWER_OUTAGE',
            source: 'light.red',
            target: 'light.red.flashing'
          },
          {
            event: 'POWER_OUTAGE',
            source: 'light.yellow',
            target: 'light.red.flashing'
          },
          {
            event: 'POWER_OUTAGE',
            source: 'light.green',
            target: 'light.red.flashing'
          }
        ]
      );
    });
  });

  describe('getAdjacencyMap()', () => {
    it('should return a flattened adjacency map', () => {
      assert.deepEqual(getAdjacencyMap(lightMachine), {
        green: {
          TIMER: { state: 'yellow' },
          POWER_OUTAGE: { state: { red: 'flashing' } }
        },
        yellow: {
          TIMER: { state: { red: 'walk' } },
          POWER_OUTAGE: { state: { red: 'flashing' } }
        },
        red: {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } }
        },
        'red.walk': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: { red: 'wait' } }
        },
        'red.wait': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } },
          PED_COUNTDOWN: { state: { red: 'stop' } }
        },
        'red.stop': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } }
        },
        'red.flashing': {
          TIMER: { state: 'green' },
          POWER_OUTAGE: { state: { red: 'flashing' } }
        }
      });
    });
  });

  describe('getShortestPaths()', () => {
    it('should return a mapping of shortest paths to all states', () => {
      assert.deepEqual(getShortestPaths(lightMachine), {
        green: [],
        yellow: [{ state: 'green', event: 'TIMER' }],
        'red.flashing': [{ state: 'green', event: 'POWER_OUTAGE' }],
        'red.walk': [
          { state: 'green', event: 'TIMER' },
          { state: 'yellow', event: 'TIMER' }
        ],
        'red.wait': [
          { state: 'green', event: 'TIMER' },
          { state: 'yellow', event: 'TIMER' },
          { state: 'red.walk', event: 'PED_COUNTDOWN' }
        ],
        'red.stop': [
          { state: 'green', event: 'TIMER' },
          { state: 'yellow', event: 'TIMER' },
          { state: 'red.walk', event: 'PED_COUNTDOWN' },
          { state: 'red.wait', event: 'PED_COUNTDOWN' }
        ]
      });
    });

    it('the initial state should have a zero-length path', () => {
      assert.lengthOf(
        (getShortestPaths(lightMachine) as IPathMap)[`${lightMachine.initial}`],
        0
      );
    });
  });

  describe('getSimplePaths()', () => {
    it('should return a mapping of arrays of simple paths to all states', () => {
      assert.deepEqual(getSimplePaths(lightMachine), {
        green: [[]],
        'red.flashing': [
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'TIMER',
              state: 'yellow'
            },
            {
              event: 'POWER_OUTAGE',
              state: 'red.walk'
            }
          ],
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'TIMER',
              state: 'yellow'
            },
            {
              event: 'PED_COUNTDOWN',
              state: 'red.walk'
            },
            {
              event: 'POWER_OUTAGE',
              state: 'red.wait'
            }
          ],
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'TIMER',
              state: 'yellow'
            },
            {
              event: 'PED_COUNTDOWN',
              state: 'red.walk'
            },
            {
              event: 'PED_COUNTDOWN',
              state: 'red.wait'
            },
            {
              event: 'POWER_OUTAGE',
              state: 'red.stop'
            }
          ],
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'POWER_OUTAGE',
              state: 'yellow'
            }
          ],
          [
            {
              event: 'POWER_OUTAGE',
              state: 'green'
            }
          ]
        ],
        'red.stop': [
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'TIMER',
              state: 'yellow'
            },
            {
              event: 'PED_COUNTDOWN',
              state: 'red.walk'
            },
            {
              event: 'PED_COUNTDOWN',
              state: 'red.wait'
            }
          ]
        ],
        'red.wait': [
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'TIMER',
              state: 'yellow'
            },
            {
              event: 'PED_COUNTDOWN',
              state: 'red.walk'
            }
          ]
        ],
        'red.walk': [
          [
            {
              event: 'TIMER',
              state: 'green'
            },
            {
              event: 'TIMER',
              state: 'yellow'
            }
          ]
        ],
        yellow: [
          [
            {
              event: 'TIMER',
              state: 'green'
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

    it('should return multiple paths for equivalent transitions', () => {
      assert.deepEqual(getSimplePaths(equivMachine), {
        a: [[]],
        b: [
          [
            {
              event: 'FOO',
              state: 'a'
            }
          ],
          [
            {
              event: 'BAR',
              state: 'a'
            }
          ]
        ]
      });
    });

    it('should return a single empty path for the initial state', () => {
      assert.deepEqual(getSimplePaths(lightMachine)!.green, [[]]);
      assert.deepEqual(getSimplePaths(equivMachine)!.a, [[]]);
    });
  });
});
