import { assert } from 'chai';
import { Machine, StateNode } from '../src/index';
import { getNodes, getEdges } from '../src/graph';

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
      stop: {}
    }
  };

  const lightMachine = new Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        ...pedestrianStates
      }
    }
  });

  describe('getNodes()', () => {
    it('should return an array of all nodes', () => {
      const nodes = getNodes(lightMachine);
      assert.ok(nodes.every(node => node instanceof StateNode));
      assert.deepEqual(nodes.map(node => node.id), [
        'light.green',
        'light.yellow',
        'light.red',
        'light.red.walk',
        'light.red.wait',
        'light.red.stop'
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
          { action: 'POWER_OUTAGE', source: 'light.red', target: 'light.red' },
          {
            action: 'POWER_OUTAGE',
            source: 'light.yellow',
            target: 'light.red'
          },
          { action: 'POWER_OUTAGE', source: 'light.green', target: 'light.red' }
        ]
      );
    });
  });
});
