import { Machine } from '../src/index';
import { actionTypes } from '../src/actions';

const lightMachine = Machine({
  key: 'light',
  initial: 'green',
  states: {
    green: {
      invoke: ['fadeInGreen'],
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
      invoke: ['activateCrosswalkLight'],
      on: {
        TIMER: 'green'
      },
      states: {
        walk: { on: { PED_WAIT: 'wait' } },
        wait: {
          invoke: ['blinkCrosswalkLight'],
          on: { PED_STOP: 'stop' }
        },
        stop: {}
      }
    }
  }
});

describe('activities with guarded transitions', () => {
  const machine = Machine({
    initial: 'A',
    states: {
      A: {
        on: {
          E: 'B'
        }
      },
      B: {
        invoke: ['B_ACTIVITY'],
        on: {
          '': [{ cond: () => false, target: 'A' }]
        }
      }
    }
  });

  it('should activate even if there are subsequent automatic, but blocked transitions', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'E');

    expect(
      Object.values(state.children).find(
        child => child.meta!.src === 'B_ACTIVITY'
      )
    ).toBeTruthy();
    expect(state.actions).toContainEqual(
      expect.objectContaining({ type: actionTypes.start })
    );
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
        invoke: 'B_ACTIVITY',
        on: {
          E: 'A'
        }
      }
    }
  });

  it('should remember the activities even after an event', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'E');
    state = machine.transition(state, 'IGNORE');
    expect(
      Object.values(state.children).find(
        child => child.meta!.src === 'B_ACTIVITY'
      )
    ).toBeTruthy();
  });
});

describe('activities', () => {
  it('identifies initial activities', () => {
    const { initialState } = lightMachine;

    expect(
      Object.values(initialState.children).find(
        child => child.meta!.src === 'fadeInGreen'
      )
    ).toBeTruthy();
  });
  it('identifies start activities', () => {
    const nextState = lightMachine.transition('yellow', 'TIMER');
    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'activateCrosswalkLight'
      )
    ).toBeTruthy();
    expect(nextState.actions).toContainEqual(
      expect.objectContaining({
        actor: expect.objectContaining({ src: 'activateCrosswalkLight' })
      })
    );
  });

  it('identifies start activities for child states and active activities', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const nextState = lightMachine.transition(redWalkState, 'PED_WAIT');
    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'activateCrosswalkLight'
      )
    ).toBeTruthy();
    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'blinkCrosswalkLight'
      )
    ).toBeTruthy();
    expect(nextState.actions).toContainEqual(
      expect.objectContaining({
        type: actionTypes.start,
        actor: expect.objectContaining({
          src: 'blinkCrosswalkLight'
        })
      })
    );
  });

  it('identifies stop activities for child states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');
    const nextState = lightMachine.transition(redWaitState, 'PED_STOP');

    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'activateCrosswalkLight'
      )
    ).toBeTruthy();
    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'blinkCrosswalkLight'
      )
    ).toBeFalsy();
    expect(nextState.actions).toContainEqual(
      expect.objectContaining({
        type: actionTypes.stop,
        actor: expect.objectContaining({ src: 'blinkCrosswalkLight' })
      })
    );
  });

  it('identifies multiple stop activities for child and parent states', () => {
    const redWalkState = lightMachine.transition('yellow', 'TIMER');
    const redWaitState = lightMachine.transition(redWalkState, 'PED_WAIT');
    const redStopState = lightMachine.transition(redWaitState, 'PED_STOP');
    const nextState = lightMachine.transition(redStopState, 'TIMER');

    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'fadeInGreen'
      )
    ).toBeTruthy();
    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'activateCrosswalkLight'
      )
    ).toBeFalsy();
    expect(
      Object.values(nextState.children).find(
        child => child.meta!.src === 'blinkCrosswalkLight'
      )
    ).toBeFalsy();

    expect(nextState.actions).toContainEqual(
      expect.objectContaining({
        type: actionTypes.stop,
        actor: expect.objectContaining({ src: 'activateCrosswalkLight' })
      })
    );

    expect(nextState.actions).toContainEqual(
      expect.objectContaining({
        type: actionTypes.start,
        actor: expect.objectContaining({ src: 'fadeInGreen' })
      })
    );
  });
});

describe('transient activities', () => {
  const machine = Machine({
    type: 'parallel',
    states: {
      A: {
        invoke: ['A'],
        initial: 'A1',
        states: {
          A1: {
            invoke: ['A1'],
            on: {
              A: 'AWAIT'
            }
          },
          AWAIT: {
            invoke: ['AWAIT'],
            on: {
              '': 'A2'
            }
          },
          A2: {
            invoke: ['A2'],
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
        invoke: ['B'],
        states: {
          B1: {
            invoke: ['B1'],
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
            invoke: ['B2'],
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
            invoke: ['C1'],
            on: {
              C: 'C1',
              C_SIMILAR: 'C2'
            }
          },
          C2: {
            invoke: ['C1']
          }
        }
      }
    }
  });

  it('should have started initial activities', () => {
    const state = machine.initialState;
    expect(
      Object.values(state.children).find(child => child.meta!.src === 'A')
    ).toBeTruthy();
  });

  it('should have started deep initial activities', () => {
    const state = machine.initialState;
    expect(
      Object.values(state.children).find(child => child.meta!.src === 'A1')
    ).toBeTruthy();
  });

  it('should have kept existing activities', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'A');
    expect(
      Object.values(state.children).find(child => child.meta!.src === 'A')
    ).toBeTruthy();
  });

  it('should have kept same activities', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'C_SIMILAR');
    expect(
      Object.values(state.children).find(child => child.meta!.src === 'C1')
    ).toBeTruthy();
  });

  it('should have kept same activities after self transition', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'C');
    expect(
      Object.values(state.children).find(child => child.meta!.src === 'C1')
    ).toBeTruthy();
  });

  it.skip('should have stopped after automatic transitions', () => {
    let state = machine.initialState;
    state = machine.transition(state, 'A');
    expect(state.value).toEqual({ A: 'A2', B: 'B2', C: 'C1' });
    expect(
      Object.values(state.children).find(child => child.meta!.src === 'B2')
    ).toBeTruthy();
  });
});
