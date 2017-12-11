import { assert } from 'chai';
import { Machine, StateNode } from '../src/index';
import {
  getNodes,
  getEdges,
  getAdjacencyMap,
  getShortestPaths,
  IPathMap
} from '../src/graph';

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
          typeof edge.action === 'string' &&
          edge.source instanceof StateNode &&
          edge.target instanceof StateNode
        );
      });
      assert.deepEqual(
        edges.map(edge => ({
          action: edge.action,
          source: edge.source.id,
          target: edge.target.id
        })),
        [
          { action: 'TIMER', source: 'light.green', target: 'light.yellow' },
          { action: 'TIMER', source: 'light.yellow', target: 'light.red' },
          {
            action: 'PED_COUNTDOWN',
            source: 'light.red.walk',
            target: 'light.red.wait'
          },
          {
            action: 'PED_COUNTDOWN',
            source: 'light.red.wait',
            target: 'light.red.stop'
          },
          { action: 'TIMER', source: 'light.red', target: 'light.green' },
          {
            action: 'POWER_OUTAGE',
            source: 'light.red',
            target: 'light.red.flashing'
          },
          {
            action: 'POWER_OUTAGE',
            source: 'light.yellow',
            target: 'light.red.flashing'
          },
          {
            action: 'POWER_OUTAGE',
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
        yellow: [{ state: 'green', action: 'TIMER' }],
        'red.flashing': [{ state: 'green', action: 'POWER_OUTAGE' }],
        'red.walk': [
          { state: 'green', action: 'TIMER' },
          { state: 'yellow', action: 'TIMER' }
        ],
        'red.wait': [
          { state: 'green', action: 'TIMER' },
          { state: 'yellow', action: 'TIMER' },
          { state: 'red.walk', action: 'PED_COUNTDOWN' }
        ],
        'red.stop': [
          { state: 'green', action: 'TIMER' },
          { state: 'yellow', action: 'TIMER' },
          { state: 'red.walk', action: 'PED_COUNTDOWN' },
          { state: 'red.wait', action: 'PED_COUNTDOWN' }
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
});
