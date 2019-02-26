import { Machine } from '../src/index';
import { assert } from 'chai';

const wordMachine = Machine({
  key: 'word',
  type: 'parallel',
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
        RIGHT_CLICK_EXTERNAL: {
          target: '.right',
          internal: false
        },
        CENTER_CLICK: '.center',
        JUSTIFY_CLICK: '.justify',
        RESET: 'direction', // explicit self-transition
        RESET_TO_CENTER: 'direction.center'
      }
    }
  }
});

const topLevelMachine = Machine({
  initial: 'Hidden',
  on: {
    CLICKED_CLOSE: '.Hidden',
    TARGETLESS_ARRAY: [{ actions: ['doSomethingParent'] }],
    TARGETLESS_OBJECT: { actions: ['doSomethingParent'] },
    PARENT_EVENT: { actions: ['handleParentEvent'] }
  },
  states: {
    Hidden: {
      on: {
        PUBLISH_FAILURE: 'Failure',
        TARGETLESS_ARRAY: [{ actions: ['doSomething'] }],
        TARGETLESS_OBJECT: { actions: ['doSomething'] }
      }
    },
    Failure: {}
  }
});

describe('internal transitions', () => {
  it('parent state should enter child state without re-entering self', () => {
    const nextState = wordMachine.transition(
      wordMachine.initialState,
      'RIGHT_CLICK'
    );

    assert.deepEqual(nextState.value, { direction: 'right' });
    assert.lengthOf(
      nextState.actions,
      0,
      'should not have onEntry or onExit actions'
    );
  });

  it('parent state should re-enter self upon transitioning to child state if internal is false', () => {
    const nextState = wordMachine.transition(
      wordMachine.initialState,
      'RIGHT_CLICK_EXTERNAL'
    );

    assert.deepEqual(nextState.value, { direction: 'right' });
    assert.lengthOf(
      nextState.actions,
      2,
      'should have onEntry and onExit actions'
    );
    assert.deepEqual(nextState.actions.map(a => a.type), [
      'EXIT_DIRECTION',
      'ENTER_DIRECTION'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition', () => {
    const resetState = wordMachine.transition('direction.center', 'RESET');

    assert.deepEqual(resetState.value, { direction: 'left' });
    assert.deepEqual(resetState.actions.map(a => a.type), [
      'EXIT_DIRECTION',
      'ENTER_DIRECTION'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition (to child)', () => {
    const resetState = wordMachine.transition(
      'direction.right',
      'RESET_TO_CENTER'
    );

    assert.deepEqual(resetState.value, { direction: 'center' });
    assert.deepEqual(resetState.actions.map(a => a.type), [
      'EXIT_DIRECTION',
      'ENTER_DIRECTION'
    ]);
  });

  it('should listen to events declared at top state', () => {
    const actualState = topLevelMachine.transition('Failure', 'CLICKED_CLOSE');

    assert.deepEqual(actualState.value, 'Hidden');
  });

  it('should work with targetless transitions (in conditional array)', () => {
    const sameState = topLevelMachine.transition('Hidden', 'TARGETLESS_ARRAY');

    assert.deepEqual(sameState.actions.map(a => a.type), ['doSomething']);
  });

  it('should work with targetless transitions (in object)', () => {
    const sameState = topLevelMachine.transition('Hidden', 'TARGETLESS_OBJECT');

    assert.deepEqual(sameState.actions.map(a => a.type), ['doSomething']);
  });

  it('should work on parent with targetless transitions (in conditional array)', () => {
    const sameState = topLevelMachine.transition('Failure', 'TARGETLESS_ARRAY');

    assert.deepEqual(sameState.actions.map(a => a.type), ['doSomethingParent']);
  });

  it('should work with targetless transitions (in object)', () => {
    const sameState = topLevelMachine.transition(
      'Failure',
      'TARGETLESS_OBJECT'
    );

    assert.deepEqual(sameState.actions.map(a => a.type), ['doSomethingParent']);
  });

  it('should maintain the child state when targetless transition is handled by parent', () => {
    const hiddenState = topLevelMachine.transition('Hidden', 'PARENT_EVENT');

    assert.deepEqual(hiddenState.value, 'Hidden');
  });
});
