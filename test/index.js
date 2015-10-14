
import assert from 'assert';
import should from 'should';
import machine, { Signal } from '../dist/index';
import _ from 'lodash';

describe('machine', () => {
  let pedestrianMachine = {
    id: 'pedestrian',
    initial: true,
    states: [
      {
        id: 'walk',
        initial: true,
        transitions: [
          {
            event: 'PED_COUNTDOWN',
            target: 'wait'
          }
        ]
      },
      {
        id: 'wait',
        transitions: [
          {
            event: 'PED_COUNTDOWN',
            target: 'stop',
            cond: (data) => data.value >= 20
          }
        ]
      },
      {
        id: 'stop'
      }
    ]
  };

  let lightMachine = machine({
    id: 'light-machine',
    states: [
      {
        id: 'green',
        initial: true,
        transitions: [
          {
            event: 'TIMER',
            target: 'yellow'
          },
          {
            event: 'POWER_OUTAGE',
            target: 'red'
          }
        ]
      },
      {
        id: 'yellow',
        transitions: [
          {
            event: 'TIMER',
            target: 'red'
          }
        ]
      },
      {
        id: 'red',
        states: [ pedestrianMachine ],
        transitions: [
          {
            event: 'TIMER',
            target: 'green'
          }
        ]
      }
    ]
  });

  let testMachine = machine({
    states: [
      {
        id: 'a',
        transitions: [
          {
            event: 'T',
            target: 'b.b1'
          }
        ]
      },
      {
        id: 'b',
        states: [
          {
            id: 'b1'
          }
        ]
      }
    ]
  });

  describe('machine.states', () => {
    it('should properly register machine states', () => {
      assert.deepEqual(
        _.pluck(lightMachine.states, 'id'),
        ['green', 'yellow', 'red']);
    });

    it('should create instances of State class', () => {
      assert.ok(_.every(lightMachine.states,
        (state) => state.constructor.name === 'State'));
    });
  });

  xdescribe('machine.getInitialStates()', () => {
    let testMachine = machine({
      states: [
        {
          id: 'a',
          initial: true
        },
        {
          id: 'b',
          initial: true
        },
        {
          id: 'c',
          initial: true,
          states: [
            {
              id: 'c1',
              initial: true
            },
            {
              id: 'c2',
              initial: true
            },
          ]
        },
      ]
    });

    it('should return an array of all initial states', () => {
      assert.deepEqual(
        lightMachine.getInitialStates(),
        ['light-machine.green']);
    });

    it('should recursively return an array of all initial states', () => {

      assert.deepEqual(
        testMachine.getInitialStates(),
        [
          'root.a',
          'root.b',
          'root.c.c1',
          'root.c.c2'
        ]);
    });

    it('should return initial states from a specified state', () => {
      assert.deepEqual(
        testMachine.getState('c').getInitialStates(),
        ['c.c1', 'c.c2']);
    });
  });

  describe('machine.getState()', () => {
    it('should find a substate from a string state ID', () => {
      assert.equal(
        lightMachine.getState('yellow').id,
        'yellow');

      assert.ok(
        lightMachine.getState('yellow').constructor.name === 'State');
    });

    it('should find a nested substate from a delimited string state ID', () => {
      assert.equal(
        lightMachine.getState('red.pedestrian.walk').id,
        'walk');

      assert.ok(
        lightMachine.getState('red.pedestrian.walk').constructor.name === 'State');
    });

    it('should return false for invalid substates', () => {
      assert.equal(
        lightMachine.getState('fake'),
        false);

      assert.equal(
        lightMachine.getState('fake.nested.substate'),
        false);

      assert.equal(
        lightMachine.getState('red.partially.fake'),
        false);
    });

    it('should return the original state for falsey fromState values', () => {
      assert.equal(
        lightMachine.getState().id,
        'light-machine');

      assert.equal(
        lightMachine.getState(null).id,
        'light-machine');

      assert.equal(
        lightMachine.getState('red').getState().id,
        'red');
    });
  });

  describe('machine.transition()', () => {
    it('should properly execute a simple transition from state', () => {
      assert.deepEqual(
        lightMachine.getState('green').transition(null, 'TIMER'),
        ['yellow']);
    });

    it('should implicitly transition from initial states', () => {
      assert.deepEqual(
        lightMachine.transition(null, 'TIMER'),
        ['light-machine.yellow']);
    })

    it('should properly transition states based on string event', () => {
      assert.deepEqual(
        lightMachine.transition('green', 'TIMER'),
        ['yellow']);
    });

    it('should transition from the original state when fromState is empty', () => {
      assert.deepEqual(
        lightMachine.getState('green').transition(null, 'TIMER'),
        ['yellow']);
    });

    it('should properly transition states based on signal-like object', () => {
      let signal = {
        event: 'TIMER'
      };

      assert.deepEqual(
        lightMachine.transition('green', signal),
        ['yellow']);
    });

    it('should return initial state(s) without any arguments for transition()', () => {
      assert.deepEqual(
        lightMachine.transition(),
        ['light-machine.green']);

      assert.deepEqual(
        lightMachine.getState('green').transition(),
        ['green']);
    });

    it('should return no states for illegal transitions', () => {
      assert.deepEqual(
        lightMachine.transition('green', 'FAKE'),
        []);
    });

    it('should transition to initial substates without any signal', () => {
      assert.deepEqual(
        lightMachine.transition('red'),
        ['red.pedestrian.walk']);

      assert.deepEqual(
        lightMachine.transition('red.pedestrian'),
        ['pedestrian.walk']);
    });

    it('should transition to nested states as target', () => {
      assert.deepEqual(
        testMachine.transition('a', 'T'),
        ['b.b1']);
    });
  });

  describe('machine.transition() with nested states', () => {
    it('should properly transition a nested state', () => {
      assert.deepEqual(
        lightMachine.transition('red.pedestrian.walk', 'PED_COUNTDOWN'),
        ['wait']);
    });

    it('should transition from initial nested states', () => {
      assert.deepEqual(
        lightMachine.transition('red.pedestrian', 'PED_COUNTDOWN'),
        ['pedestrian.wait']);
    });

    it('should transition from deep initial nested states', () => {
      assert.deepEqual(
        lightMachine.transition('red', 'PED_COUNTDOWN'),
        ['red.pedestrian.wait']);
    });

    it('should transition to initial nested states with no signal', () => {
      assert.deepEqual(
        lightMachine.transition('red'),
        ['red.pedestrian.walk']);

      assert.deepEqual(
        lightMachine.transition('red.pedestrian'),
        ['pedestrian.walk']);
    });

    it('should bubble up signals that nested states cannot handle', () => {
      assert.deepEqual(
        lightMachine.transition('red.pedestrian.wait', 'TIMER'),
        ['green']);

      assert.deepEqual(
        lightMachine.transition('red.pedestrian', 'TIMER'),
        ['green']);
    });

    it('should return no states for illegal transitions in nested states that composite states cannot handle', () => {
      assert.deepEqual(
        lightMachine.transition('red.pedestrian.walk', 'FAKE'),
        []);

      assert.deepEqual(
        lightMachine.transition('red', 'FAKE'),
        []);
    });
  });

  describe('parallel states', () => {
    let parallelMachine = machine({
      id: 'parallel-machine',
      states: [
        {
          id: 'a',
          initial: true
        },
        {
          id: 'b',
          initial: true,
          transitions: [
            {
              event: 'T',
              target: 'c'
            }
          ]
        },
        {
          id: 'c',
          states: [
            {
              id: 'c1',
              initial: true
            },
            {
              id: 'c2',
              initial: true
            }
          ]
        }
      ]
    });

    it('should return all initial (parallel) states without any arguments for transition()', () => {
      assert.deepEqual(
        parallelMachine.transition(),
        ['parallel-machine.a', 'parallel-machine.b']);
    });

    it('should return all initial (parallel) nested states when transitioning to a state', () => {
      assert.deepEqual(
        parallelMachine.transition('b', 'T'),
        ['c.c1', 'c.c2']);
    });
  });
});
