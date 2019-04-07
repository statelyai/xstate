import { assert } from 'chai';
import { Machine } from '../src/index';
import { start, stop } from '../src/actions';

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      activities: ['fadeInGreen'],
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      initial: 'walk',
      activities: ['activateCrosswalkLight'],
      on: {
        TIMER: 'green'
      },
      states: {
        walk: { on: { PED_WAIT: 'wait' } },
        wait: {
          activities: ['blinkCrosswalkLight'],
          on: { PED_STOP: 'stop' }
        },
        stop: {}
      }
    }
  }
});

describe('activities with guarded transitions', () => {
  const B_ACTIVITY = () => void 0;
  const machine = Machine(
    {
      initial: 'A',
      states: {
        A: {
          on: {
            E: 'B'
          }
        },
        B: {
          on: {
            '': [{ cond: () => false, target: 'A' }]
          },
          activities: ['B_ACTIVITY']
        }
      }
    },
    { activities: { B_ACTIVITY } }
  );

  it('should activate even if there are subsequent automatic, but blocked transitions', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'E');
    assert.ok(state.activities.B_ACTIVITY);
    assert.deepEqual(state.actions, [
      start({ type: 'B_ACTIVITY', id: 'B_ACTIVITY', exec: undefined })
    ]);
    // assert.isFunction(
    //   state.actions[0].exec,
    //   'Activity start function should be defined'
    // );
  });
});

describe('remembering activities', () => {
  const machine = Machine({
    initial: 'A',
    states: {
      A: {
        on: {
          E: 'B'
        }
      },
      B: {
        on: {
          E: 'A'
        },
        activities: ['B_ACTIVITY']
      }
    }
  });

  it('should remember the activities even after an event', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'E');
    state = machine.transition(state, 'IGNORE');
    assert.ok(state.activities.B_ACTIVITY);
  });
});

describe('activities', () => {
  it('identifies initial activities', () => {
    const { initialState } = lightMachine;

    assert.ok(initialState.activities.fadeInGreen);
  });
  it('identifies start activities', () => {
    const nextState = lightMachine.transition('yellow', 'TIMER');
    assert.ok(nextState.activities.activateCrosswalkLight);
    assert.sameDeepMembers(nextState.actions, [
      start('activateCrosswalkLight')
    ]);
  });

  it('identifies start activities for child states and active activities', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const nextState = lightMachine.transition(redWalkState, 'PED_WAIT');
    assert.ok(nextState.activities.activateCrosswalkLight);
    assert.ok(nextState.activities.blinkCrosswalkLight);
    assert.sameDeepMembers(nextState.actions, [start('blinkCrosswalkLight')]);
  });

  it('identifies stop activities for child states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');
    const nextState = lightMachine.transition(redWaitState, 'PED_STOP');

    assert.ok(nextState.activities.activateCrosswalkLight);
    assert.isFalse(nextState.activities.blinkCrosswalkLight);
    assert.sameDeepMembers(nextState.actions, [stop('blinkCrosswalkLight')]);
  });

  it('identifies multiple stop activities for child and parent states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');
    const redStopState = lightMachine.transition(redWaitState, 'PED_STOP');
    const nextState = lightMachine.transition(redStopState, 'TIMER');

    assert.ok(nextState.activities.fadeInGreen);
    assert.isFalse(nextState.activities.activateCrosswalkLight);
    assert.isFalse(nextState.activities.blinkCrosswalkLight);

    assert.sameDeepMembers(nextState.actions, [
      start('fadeInGreen'),
      stop('activateCrosswalkLight')
    ]);
  });
});

describe('transient activities', () => {
  const machine = Machine({
    type: 'parallel',
    states: {
      A: {
        activities: ['A'],
        initial: 'A1',
        states: {
          A1: {
            activities: ['A1'],
            on: {
              A: 'AWAIT'
            }
          },
          AWAIT: {
            activities: ['AWAIT'],
            on: {
              '': 'A2'
            }
          },
          A2: {
            activities: ['A2'],
            on: {
              A: 'A1'
            }
          }
        },
        on: {
          A1: '.A1',
          A2: '.A2'
        }
      },
      B: {
        initial: 'B1',
        activities: ['B'],
        states: {
          B1: {
            activities: ['B1'],
            on: {
              '': [
                {
                  in: 'A.AWAIT',
                  target: 'B2'
                }
              ],
              B: 'B2'
            }
          },
          B2: {
            activities: ['B2'],
            on: {
              B: 'B1'
            }
          }
        },
        on: {
          B1: '.B1',
          B2: '.B2'
        }
      },
      C: {
        initial: 'C1',
        states: {
          C1: {
            activities: ['C1'],
            on: {
              C: 'C1',
              C_SIMILAR: 'C2'
            }
          },
          C2: {
            activities: ['C1']
          }
        }
      }
    }
  });

  it('should have started initial activities', () => {
    const state = machine.initialState;
    assert.ok(state.activities.A);
  });

  it('should have started deep initial activities', () => {
    const state = machine.initialState;
    assert.ok(state.activities.A1);
  });

  it('should have kept existing activities', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'A');
    assert.ok(state.activities.A);
  });

  it('should have kept same activities', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'C_SIMILAR');
    assert.ok(state.activities.C1);
  });

  it('should have kept same activities after self transition', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'C');
    assert.ok(state.activities.C1);
  });

  it('should have stopped after automatic transitions', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'A');
    assert.deepEqual(state.value, { A: 'A2', B: 'B2', C: 'C1' });
    assert.ok(state.activities.B2);
  });
});
