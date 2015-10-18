import assert from 'assert';
import should from 'should';
import machine from '../lib/nfa';
import _ from 'lodash';

describe('nondeterministic machine', () => {
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
  
  describe('machine.transition()', () => {

    it('should implicitly transition from initial states', () => {
      assert.deepEqual(
        lightMachine.transition(null, 'TIMER'),
        ['yellow']);
    })

    it('should properly transition states based on string event', () => {
      assert.deepEqual(
        lightMachine.transition('green', 'TIMER'),
        ['yellow']);
    });

    it('should properly transition states based on signal-like object', () => {
      let signal = {
        type: 'TIMER'
      };

      assert.deepEqual(
        lightMachine.transition('green', signal),
        ['yellow']);
    });

    it('should return initial state(s) without any arguments for transition()', () => {
      assert.deepEqual(
        lightMachine.transition(),
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
        ['red.pedestrian.walk']);
    });

    it('should transition to nested states as target', () => {
      assert.deepEqual(
        testMachine.transition('a', 'T'),
        ['b.b1']);
    });

    it('should return an empty array for transitions from invalid states', () => {
      assert.deepEqual(
        testMachine.transition('fake', 'T'),
        []);
    });

    it('should return an empty array for transitions from invalid substates', () => {
      assert.deepEqual(
        testMachine.transition('a.fake', 'T'),
        []);
    });
  });

  describe('machine.transition() with nested states', () => {
    it('should properly transition a nested state', () => {
      assert.deepEqual(
        lightMachine.transition('red.pedestrian.walk', 'PED_COUNTDOWN'),
        ['red.pedestrian.wait']);
    });

    it('should transition from initial nested states', () => {
      assert.deepEqual(
        lightMachine.transition('red.pedestrian', 'PED_COUNTDOWN'),
        ['red.pedestrian.wait']);
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
        ['red.pedestrian.walk']);
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
        ['a', 'b']);
    });

    it('should return all initial (parallel) nested states when transitioning to a state', () => {
      assert.deepEqual(
        parallelMachine.transition('b', 'T'),
        ['c.c1', 'c.c2']);
    });
  });
});
