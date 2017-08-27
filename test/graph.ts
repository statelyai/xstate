import { assert } from 'chai';
import { Machine, StateNode } from '../src/index';
import {
  getNodes,
  getEdges,
  getAdjacencyMap,
  getShortestPaths
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
        'light.green': {
          TIMER: 'light.yellow',
          POWER_OUTAGE: 'light.red.flashing'
        },
        'light.yellow': {
          TIMER: 'light.red.walk',
          POWER_OUTAGE: 'light.red.flashing'
        },
        'light.red': {
          TIMER: 'light.green',
          POWER_OUTAGE: 'light.red.flashing'
        },
        'light.red.walk': {
          TIMER: 'light.green',
          POWER_OUTAGE: 'light.red.flashing',
          PED_COUNTDOWN: 'light.red.wait'
        },
        'light.red.wait': {
          TIMER: 'light.green',
          POWER_OUTAGE: 'light.red.flashing',
          PED_COUNTDOWN: 'light.red.stop'
        },
        'light.red.stop': {
          TIMER: 'light.green',
          POWER_OUTAGE: 'light.red.flashing'
        },
        'light.red.flashing': {
          TIMER: 'light.green',
          POWER_OUTAGE: 'light.red.flashing'
        }
      });
    });
  });

  describe('getShortestPaths()', () => {
    it('should return a mapping of shortest paths to all states', () => {
      assert.deepEqual(getShortestPaths(lightMachine), {
        'light.green': [],
        'light.yellow': ['light.green'],
        'light.red.flashing': ['light.green'],
        'light.red.walk': ['light.green', 'light.yellow'],
        'light.red.wait': ['light.green', 'light.yellow', 'light.red.walk'],
        'light.red.stop': [
          'light.green',
          'light.yellow',
          'light.red.walk',
          'light.red.wait'
        ]
      });
    });

    it('the initial state should have a zero-length path', () => {
      assert.lengthOf(
        getShortestPaths(lightMachine)[
          `${lightMachine.id}.${lightMachine.initial}`
        ],
        0
      );
    });
  });
});
