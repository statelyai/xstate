import { createMachine } from '../src';
import { raise } from '../src/actions/raise';
import { toSCXMLEvent } from '../src/utils';

describe('machine.microstep()', () => {
  it('should return the state from microstep (transient)', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: 'second'
          }
        },
        second: {
          always: 'third'
        },
        third: {}
      }
    });

    const state = machine.microstep(
      machine.resolveStateValue('first'),
      'TRIGGER',
      undefined
    );
    expect(state.matches('second')).toBeTruthy();
  });

  it('should return the state from microstep (raised event)', () => {
    const machine = createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            TRIGGER: {
              target: 'second',
              actions: raise('RAISED')
            }
          }
        },
        second: {
          on: {
            RAISED: 'third'
          }
        },
        third: {}
      }
    });

    const state = machine.microstep(
      machine.resolveStateValue('first'),
      'TRIGGER',
      undefined
    );

    expect(state.matches('second')).toBeTruthy();
    expect(state._internalQueue).toContainEqual(
      expect.objectContaining(
        toSCXMLEvent({
          type: 'RAISED'
        })
      )
    );
  });
});
