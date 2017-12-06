import { assert } from 'chai';
import { Machine, State } from '../src/index';

describe('guard conditions', () => {
  const lightMachine = Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: {
            green: ({ elapsed }) => elapsed < 100,
            yellow: ({ elapsed }) => elapsed >= 100 && elapsed < 200
          }
        }
      },
      yellow: {}
    }
  });

  it('should transition only if condition is met', () => {
    assert.equal(
      (lightMachine.transition('green', 'TIMER', {
        elapsed: 50
      }) as State).toString(),
      'green'
    );

    assert.equal(
      (lightMachine.transition('green', 'TIMER', {
        elapsed: 120
      }) as State).toString(),
      'yellow'
    );
  });

  it('should not transition if no condition is met', () => {
    assert.isUndefined(lightMachine.transition('green', 'TIMER', {
      elapsed: 9000
    }) as State);
  });
});
