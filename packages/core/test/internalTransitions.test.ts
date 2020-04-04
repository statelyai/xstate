import { Machine } from '../src/index';

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

    expect(nextState.value).toEqual({ direction: 'right' });
    expect(nextState.actions.length).toBe(0);
  });

  it('parent state should re-enter self upon transitioning to child state if internal is false', () => {
    const nextState = wordMachine.transition(
      wordMachine.initialState,
      'RIGHT_CLICK_EXTERNAL'
    );

    expect(nextState.value).toEqual({ direction: 'right' });
    expect(nextState.actions.length).toBe(2);
    expect(nextState.actions.map((a) => a.type)).toEqual([
      'EXIT_DIRECTION',
      'ENTER_DIRECTION'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition', () => {
    const resetState = wordMachine.transition('direction.center', 'RESET');

    expect(resetState.value).toEqual({ direction: 'left' });
    expect(resetState.actions.map((a) => a.type)).toEqual([
      'EXIT_DIRECTION',
      'ENTER_DIRECTION'
    ]);
  });

  it('parent state should only exit/reenter if there is an explicit self-transition (to child)', () => {
    const resetState = wordMachine.transition(
      'direction.right',
      'RESET_TO_CENTER'
    );

    expect(resetState.value).toEqual({ direction: 'center' });
    expect(resetState.actions.map((a) => a.type)).toEqual([
      'EXIT_DIRECTION',
      'ENTER_DIRECTION'
    ]);
  });

  it('should listen to events declared at top state', () => {
    const actualState = topLevelMachine.transition('Failure', 'CLICKED_CLOSE');

    expect(actualState.value).toEqual('Hidden');
  });

  it('should work with targetless transitions (in conditional array)', () => {
    const sameState = topLevelMachine.transition('Hidden', 'TARGETLESS_ARRAY');

    expect(sameState.actions.map((a) => a.type)).toEqual(['doSomething']);
  });

  it('should work with targetless transitions (in object)', () => {
    const sameState = topLevelMachine.transition('Hidden', 'TARGETLESS_OBJECT');

    expect(sameState.actions.map((a) => a.type)).toEqual(['doSomething']);
  });

  it('should work on parent with targetless transitions (in conditional array)', () => {
    const sameState = topLevelMachine.transition('Failure', 'TARGETLESS_ARRAY');

    expect(sameState.actions.map((a) => a.type)).toEqual(['doSomethingParent']);
  });

  it('should work with targetless transitions (in object)', () => {
    const sameState = topLevelMachine.transition(
      'Failure',
      'TARGETLESS_OBJECT'
    );

    expect(sameState.actions.map((a) => a.type)).toEqual(['doSomethingParent']);
  });

  it('should maintain the child state when targetless transition is handled by parent', () => {
    const hiddenState = topLevelMachine.transition('Hidden', 'PARENT_EVENT');

    expect(hiddenState.value).toEqual('Hidden');
  });
});
