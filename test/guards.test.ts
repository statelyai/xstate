import { assert } from 'chai';
import { Machine } from '../src/index';

describe('guard conditions', () => {
  const lightMachine = Machine({
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
          }
        }
      },
      yellow: {}
    }
  });

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

  it('should not transition if no condition is met', () => {
    const nextState = lightMachine.transition('green', 'TIMER', {
      elapsed: 9000
    });
    assert.equal(nextState.value, 'green');
    assert.isEmpty(nextState.actions);
  });
});
