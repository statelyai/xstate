import { Machine } from '../src/index';
import { assert } from 'chai';

describe.only('local transitions', () => {
  const wordMachine = Machine({
    key: 'word',
    parallel: true,
    states: {
      direction: {
        initial: 'left',
        onEntry: 'ENTER_DIRECTION',
        onExit: 'EXIT_DIRECTION',
        states: {
          left: {},
          right: {},
          center: {},
          justify: {}
        },
        on: {
          // internal transitions
          LEFT_CLICK: '.left',
          RIGHT_CLICK: '.right',
          CENTER_CLICK: '.center',
          JUSTIFY_CLICK: '.justify'
        }
      }
    }
  });

  it('parent state should enter child state without re-entering self', () => {
    const nextState = wordMachine.transition(
      wordMachine.initialState,
      'RIGHT_CLICK'
    );

    console.log(nextState);

    assert.deepEqual(nextState.value, { direction: 'right' });
    assert.deepEqual(
      nextState.actions,
      [],
      'should not have onEntry or onExit actions'
    );
  });
});
