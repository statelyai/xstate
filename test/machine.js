import chai from 'chai';
import should from 'should';
import { machine } from '../lib/index';
import pluck from 'lodash/collection/pluck';
import every from 'lodash/collection/every';

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

  describe('machine.states', () => {
    it('should properly register machine states', () => {
      chai.assert.deepEqual(
        pluck(lightMachine.states, 'id'),
        ['green', 'yellow', 'red']);
    });

    it('should create instances of State class', () => {
      chai.assert.ok(every(lightMachine.states,
        (state) => state.constructor.name === 'State'));
    });
  });

  describe('machine.getState()', () => {
    it('should find a substate from a string state ID', () => {
      chai.assert.equal(
        lightMachine.getState('yellow').id,
        'yellow');

      chai.assert.ok(
        lightMachine.getState('yellow').constructor.name === 'State');
    });

    it('should find a nested substate from a delimited string state ID', () => {
      chai.assert.equal(
        lightMachine.getState('red.pedestrian.walk').id,
        'walk');

      chai.assert.ok(
        lightMachine.getState('red.pedestrian.walk').constructor.name === 'State');
    });

    it('should return false for invalid substates', () => {
      chai.assert.equal(
        lightMachine.getState('fake'),
        false);

      chai.assert.equal(
        lightMachine.getState('fake.nested.substate'),
        false);

      chai.assert.equal(
        lightMachine.getState('red.partially.fake'),
        false);
    });

    it('should return the original state for falsey fromState values', () => {
      chai.assert.equal(
        lightMachine.getState().id,
        'light-machine');

      chai.assert.equal(
        lightMachine.getState(null).id,
        'light-machine');

      chai.assert.equal(
        lightMachine.getState('red').getState().id,
        'red');
    });
  });

  describe('machine.getAlphabet()', () => {
    it('should return the set of actions accepted by machine', () => {
      chai.assert.sameMembers(
        lightMachine.getAlphabet(),
        ['TIMER', 'POWER_OUTAGE', 'PED_COUNTDOWN']);

      chai.assert.sameMembers(
        lightMachine.alphabet,
        ['TIMER', 'POWER_OUTAGE', 'PED_COUNTDOWN']);
    });
  });
});
