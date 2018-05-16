import { assert } from 'chai';
import { Machine } from '../src/index';

describe('guard conditions', () => {
  const lightMachine = Machine(
    {
      key: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: {
              green: {
                cond: ({ elapsed }) => elapsed < 100
              },
              yellow: {
                cond: ({ elapsed }) => elapsed >= 100 && elapsed < 200
              }
            },
            EMERGENCY: {
              red: { cond: (_, event) => event.isEmergency }
            }
          }
        },
        yellow: {
          on: {
            TIMER: {
              red: { cond: 'minTimeElapsed' }
            }
          }
        },
        red: {
          on: {
            BAD_COND: { red: { cond: 'doesNotExist' } }
          }
        }
      }
    },
    {
      guards: {
        minTimeElapsed: ({ elapsed }) => elapsed >= 100 && elapsed < 200
      }
    }
  );

  it('should transition only if condition is met', () => {
    assert.equal(
      lightMachine
        .transition('green', 'TIMER', {
          elapsed: 50
        })
        .toString(),
      'green'
    );

    assert.equal(
      lightMachine
        .transition('green', 'TIMER', {
          elapsed: 120
        })
        .toString(),
      'yellow'
    );
  });

  it('should transition if condition based on event is met', () => {
    assert.equal(
      lightMachine
        .transition('green', { type: 'EMERGENCY', isEmergency: true })
        .toString(),
      'red'
    );
  });

  it('should not transition if condition based on event is not met', () => {
    assert.equal(
      lightMachine.transition('green', { type: 'EMERGENCY' }).toString(),
      'green'
    );
  });

  it('should not transition if no condition is met', () => {
    const nextState = lightMachine.transition('green', 'TIMER', {
      elapsed: 9000
    });
    assert.equal(nextState.value, 'green');
    assert.isEmpty(nextState.actions);
  });

  it('should work with defined string transitions', () => {
    const nextState = lightMachine.transition('yellow', 'TIMER', {
      elapsed: 150
    });
    assert.equal(nextState.value, 'red');
  });

  it('should work with defined string transitions (condition not met)', () => {
    const nextState = lightMachine.transition('yellow', 'TIMER', {
      elapsed: 10
    });
    assert.equal(nextState.value, 'yellow');
  });

  it('should throw if string transition is not defined', () => {
    assert.throws(() => lightMachine.transition('red', 'BAD_COND'));
  });
});
