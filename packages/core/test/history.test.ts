import { interpret, createMachine } from '../src/index';

describe('history states', () => {
  const historyMachine = createMachine({
    initial: 'off',
    states: {
      off: {
        on: { POWER: 'on.hist', H_POWER: 'on.H' }
      },
      on: {
        initial: 'first',
        states: {
          first: {
            on: { SWITCH: 'second' }
          },
          second: {
            on: { SWITCH: 'third' }
          },
          third: {},
          H: {
            type: 'history'
          },
          hist: {
            type: 'history',
            history: 'shallow'
          }
        },
        on: {
          POWER: 'off',
          H_POWER: 'off'
        }
      }
    }
  });

  it('should go to the most recently visited state', () => {
    const onSecondState = historyMachine.transition('on', { type: 'SWITCH' });
    const offState = historyMachine.transition(onSecondState, {
      type: 'POWER'
    });

    expect(
      historyMachine.transition(offState, { type: 'POWER' }).value
    ).toEqual({
      on: 'second'
    });
  });

  it('should go to the most recently visited state (explicit)', () => {
    const onSecondState = historyMachine.transition('on', { type: 'SWITCH' });
    const offState = historyMachine.transition(onSecondState, {
      type: 'H_POWER'
    });

    expect(
      historyMachine.transition(offState, { type: 'H_POWER' }).value
    ).toEqual({
      on: 'second'
    });
  });

  it('should go to the initial state when no history present', () => {
    expect(historyMachine.transition('off', { type: 'POWER' }).value).toEqual({
      on: 'first'
    });
  });

  it('should go to the initial state when no history present (explicit)', () => {
    expect(historyMachine.transition('off', { type: 'H_POWER' }).value).toEqual(
      {
        on: 'first'
      }
    );
  });

  it('should go to the most recently visited state by a transient transition', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          id: 'idle',
          initial: 'absent',
          states: {
            absent: {
              on: {
                DEPLOY: '#deploy'
              }
            },
            present: {
              on: {
                DEPLOY: '#deploy',
                DESTROY: '#destroy'
              }
            },
            hist: {
              type: 'history'
            }
          }
        },
        deploy: {
          id: 'deploy',
          on: {
            SUCCESS: 'idle.present',
            FAILURE: 'idle.hist'
          }
        },
        destroy: {
          id: 'destroy',
          always: [{ target: 'idle.absent' }]
        }
      }
    });

    const service = interpret(machine).start();

    service.send({ type: 'DEPLOY' });
    service.send({ type: 'SUCCESS' });
    service.send({ type: 'DESTROY' });
    service.send({ type: 'DEPLOY' });
    service.send({ type: 'FAILURE' });

    expect(service.getSnapshot().value).toEqual({ idle: 'absent' });
  });

  it('should reenter persisted state during reentering transition targeting a history state', () => {
    const actual: string[] = [];

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            REENTER: {
              target: '#b_hist',
              reenter: true
            }
          },
          initial: 'a1',
          states: {
            a1: {
              on: {
                NEXT: 'a2'
              }
            },
            a2: {
              entry: () => actual.push('a2 entered'),
              exit: () => actual.push('a2 exited')
            },
            a3: {
              type: 'history',
              id: 'b_hist'
            }
          }
        }
      }
    });

    const service = interpret(machine).start();

    service.send({ type: 'NEXT' });

    actual.length = 0;
    service.send({ type: 'REENTER' });

    expect(actual).toEqual(['a2 exited', 'a2 entered']);
  });

  it('should go to the configured default target when a history state is the initial state of the machine', () => {
    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          type: 'history',
          target: 'bar'
        },
        bar: {}
      }
    });

    const actor = interpret(machine).start();

    expect(actor.getSnapshot().value).toBe('bar');
  });

  it(`should go to the configured default target when a history state is the initial state of the transition's target`, () => {
    const a = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            NEXT: 'bar'
          }
        },
        bar: {
          initial: 'baz',
          states: {
            baz: {
              type: 'history',
              target: 'qwe'
            },
            qwe: {}
          }
        }
      }
    });

    const actor = interpret(a).start();

    actor.send({ type: 'NEXT' });

    expect(actor.getSnapshot().value).toEqual({
      bar: 'qwe'
    });
  });
});

describe('deep history states', () => {
  const historyMachine = createMachine({
    initial: 'off',
    states: {
      off: {
        on: {
          POWER: 'on.history',
          DEEP_POWER: 'on.deepHistory'
        }
      },
      on: {
        initial: 'first',
        states: {
          first: {
            on: { SWITCH: 'second' }
          },
          second: {
            initial: 'A',
            states: {
              A: {
                on: { INNER: 'B' }
              },
              B: {
                initial: 'P',
                states: {
                  P: {
                    on: { INNER: 'Q' }
                  },
                  Q: {}
                }
              }
            }
          },
          history: { history: 'shallow' },
          deepHistory: {
            history: 'deep'
          }
        },
        on: {
          POWER: 'off'
        }
      }
    }
  });

  describe('history', () => {
    it('should go to the shallow history', () => {
      // on.first -> on.second.A
      const state2A = historyMachine.transition(
        { on: 'first' },
        { type: 'SWITCH' }
      );
      // on.second.A -> on.second.B.P
      const state2BP = historyMachine.transition(state2A, { type: 'INNER' });

      // on.second.B.P -> off
      const stateOff = historyMachine.transition(state2BP, { type: 'POWER' });
      expect(
        historyMachine.transition(stateOff, { type: 'POWER' }).value
      ).toEqual({
        on: { second: 'A' }
      });
    });

    it('should go to the deep history (explicit)', () => {
      // on.first -> on.second.A
      const state2A = historyMachine.transition(
        { on: 'first' },
        { type: 'SWITCH' }
      );
      // on.second.A -> on.second.B.P
      const state2BP = historyMachine.transition(state2A, { type: 'INNER' });

      // on.second.B.P -> off
      const stateOff = historyMachine.transition(state2BP, { type: 'POWER' });
      expect(
        historyMachine.transition(stateOff, { type: 'DEEP_POWER' }).value
      ).toEqual({
        on: { second: { B: 'P' } }
      });
    });

    it('should go to the deepest history', () => {
      // on.first -> on.second.A
      const state2A = historyMachine.transition(
        { on: 'first' },
        { type: 'SWITCH' }
      );
      // on.second.A -> on.second.B.P
      const state2BP = historyMachine.transition(state2A, { type: 'INNER' });
      // on.second.B.P -> on.second.B.Q
      const state2BQ = historyMachine.transition(state2BP, { type: 'INNER' });

      // on.second.B.Q -> off
      const stateOff = historyMachine.transition(state2BQ, { type: 'POWER' });
      expect(
        historyMachine.transition(stateOff, { type: 'DEEP_POWER' }).value
      ).toEqual({
        on: { second: { B: 'Q' } }
      });
    });
  });
});

describe('parallel history states', () => {
  const historyMachine = createMachine({
    initial: 'off',
    states: {
      off: {
        on: {
          SWITCH: 'on', // go to the initial states
          POWER: 'on.hist',
          DEEP_POWER: 'on.deepHistory',
          PARALLEL_HISTORY: [{ target: ['on.A.hist', 'on.K.hist'] }],
          PARALLEL_SOME_HISTORY: [{ target: ['on.A.C', 'on.K.hist'] }],
          PARALLEL_DEEP_HISTORY: [
            { target: ['on.A.deepHistory', 'on.K.deepHistory'] }
          ]
        }
      },
      on: {
        type: 'parallel',
        states: {
          A: {
            initial: 'B',
            states: {
              B: {
                on: { INNER_A: 'C' }
              },
              C: {
                initial: 'D',
                states: {
                  D: {
                    on: { INNER_A: 'E' }
                  },
                  E: {}
                }
              },
              hist: { history: true },
              deepHistory: {
                history: 'deep'
              }
            }
          },
          K: {
            initial: 'L',
            states: {
              L: {
                on: { INNER_K: 'M' }
              },
              M: {
                initial: 'N',
                states: {
                  N: {
                    on: { INNER_K: 'O' }
                  },
                  O: {}
                }
              },
              hist: { history: true },
              deepHistory: {
                history: 'deep'
              }
            }
          },
          hist: {
            history: true
          },
          shallowHistory: {
            history: 'shallow'
          },
          deepHistory: {
            history: 'deep'
          }
        },
        on: {
          POWER: 'off'
        }
      }
    }
  });

  it('should ignore parallel state history', () => {
    // on.first -> on.second.A
    const stateABKL = historyMachine.transition(historyMachine.initialState, {
      type: 'SWITCH'
    });
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, {
      type: 'INNER_A'
    });

    const stateOff = historyMachine.transition(stateACDKL, { type: 'POWER' });
    expect(
      historyMachine.transition(stateOff, { type: 'POWER' }).value
    ).toEqual({
      on: { A: 'B', K: 'L' }
    });
  });

  it('should remember first level state history', () => {
    // on.first -> on.second.A
    const stateABKL = historyMachine.transition(historyMachine.initialState, {
      type: 'SWITCH'
    });
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, {
      type: 'INNER_A'
    });

    const stateOff = historyMachine.transition(stateACDKL, { type: 'POWER' });
    expect(
      historyMachine.transition(stateOff, { type: 'DEEP_POWER' }).value
    ).toEqual({
      on: { A: { C: 'D' }, K: 'L' }
    });
  });

  it('should re-enter each regions of parallel state correctly', () => {
    // on.first -> on.second.A
    const stateABKL = historyMachine.transition(historyMachine.initialState, {
      type: 'SWITCH'
    });
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, {
      type: 'INNER_A'
    });
    const stateACEKL = historyMachine.transition(stateACDKL, {
      type: 'INNER_A'
    });

    // INNER_K twice
    const stateACEKMN = historyMachine.transition(stateACEKL, {
      type: 'INNER_K'
    });
    const stateACEKMO = historyMachine.transition(stateACEKMN, {
      type: 'INNER_K'
    });

    const stateOff = historyMachine.transition(stateACEKMO, { type: 'POWER' });
    expect(
      historyMachine.transition(stateOff, { type: 'DEEP_POWER' }).value
    ).toEqual({
      on: { A: { C: 'E' }, K: { M: 'O' } }
    });
  });

  it('should re-enter multiple history states', () => {
    // on.first -> on.second.A
    const stateABKL = historyMachine.transition(historyMachine.initialState, {
      type: 'SWITCH'
    });
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, {
      type: 'INNER_A'
    });
    const stateACEKL = historyMachine.transition(stateACDKL, {
      type: 'INNER_A'
    });

    // INNER_K twice
    const stateACEKMN = historyMachine.transition(stateACEKL, {
      type: 'INNER_K'
    });
    const stateACEKMO = historyMachine.transition(stateACEKMN, {
      type: 'INNER_K'
    });

    const stateOff = historyMachine.transition(stateACEKMO, { type: 'POWER' });
    expect(
      historyMachine.transition(stateOff, { type: 'PARALLEL_HISTORY' }).value
    ).toEqual({
      on: { A: { C: 'D' }, K: { M: 'N' } }
    });
  });

  it('should re-enter a parallel with partial history', () => {
    // on.first -> on.second.A
    const stateABKL = historyMachine.transition(historyMachine.initialState, {
      type: 'SWITCH'
    });
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, {
      type: 'INNER_A'
    });
    const stateACEKL = historyMachine.transition(stateACDKL, {
      type: 'INNER_A'
    });

    // INNER_K twice
    const stateACEKMN = historyMachine.transition(stateACEKL, {
      type: 'INNER_K'
    });
    const stateACEKMO = historyMachine.transition(stateACEKMN, {
      type: 'INNER_K'
    });

    const stateOff = historyMachine.transition(stateACEKMO, { type: 'POWER' });
    expect(
      historyMachine.transition(stateOff, { type: 'PARALLEL_SOME_HISTORY' })
        .value
    ).toEqual({
      on: { A: { C: 'D' }, K: { M: 'N' } }
    });
  });

  it('should re-enter a parallel with full history', () => {
    // on.first -> on.second.A
    const stateABKL = historyMachine.transition(historyMachine.initialState, {
      type: 'SWITCH'
    });
    // INNER_A twice
    const stateACDKL = historyMachine.transition(stateABKL, {
      type: 'INNER_A'
    });
    const stateACEKL = historyMachine.transition(stateACDKL, {
      type: 'INNER_A'
    });

    // INNER_K twice
    const stateACEKMN = historyMachine.transition(stateACEKL, {
      type: 'INNER_K'
    });
    const stateACEKMO = historyMachine.transition(stateACEKMN, {
      type: 'INNER_K'
    });

    const stateOff = historyMachine.transition(stateACEKMO, { type: 'POWER' });
    expect(
      historyMachine.transition(stateOff, { type: 'PARALLEL_DEEP_HISTORY' })
        .value
    ).toEqual({
      on: { A: { C: 'E' }, K: { M: 'O' } }
    });
  });
});

describe('transient history', () => {
  const transientMachine = createMachine({
    initial: 'A',
    states: {
      A: {
        on: { EVENT: 'B' }
      },
      B: {
        // eventless transition
        always: 'C'
      },
      C: {}
    }
  });

  it('should have history on transient transitions', () => {
    const nextState = transientMachine.transition('A', { type: 'EVENT' });
    expect(nextState.value).toEqual('C');
  });
});

it('internal transition to a history state should enter default history state configuration if the containing state has never been exited yet', () => {
  const service = interpret(
    createMachine({
      initial: 'first',
      states: {
        first: {
          on: {
            NEXT: 'second.other'
          }
        },
        second: {
          initial: 'nested',
          states: {
            nested: {},
            other: {},
            hist: {
              history: true
            }
          },
          on: {
            NEXT: {
              target: '.hist'
            }
          }
        }
      }
    })
  ).start();

  service.send({ type: 'NEXT' });
  service.send({ type: 'NEXT' });

  expect(service.getSnapshot().value).toEqual({
    second: 'nested'
  });
});

describe('multistage history states', () => {
  const pcWithTurboButtonMachine = createMachine({
    initial: 'off',
    states: {
      off: {
        on: { POWER: 'starting' }
      },
      starting: {
        on: { STARTED: 'running.H' }
      },
      running: {
        initial: 'normal',
        states: {
          normal: {
            on: { SWITCH_TURBO: 'turbo' }
          },
          turbo: {
            on: { SWITCH_TURBO: 'normal' }
          },
          H: {
            history: true
          }
        },
        on: {
          POWER: 'off'
        }
      }
    }
  });

  it('should go to the most recently visited state', () => {
    const onTurboState = pcWithTurboButtonMachine.transition('running', {
      type: 'SWITCH_TURBO'
    });
    const offState = pcWithTurboButtonMachine.transition(onTurboState, {
      type: 'POWER'
    });
    const loadingState = pcWithTurboButtonMachine.transition(offState, {
      type: 'POWER'
    });

    expect(
      pcWithTurboButtonMachine.transition(loadingState, { type: 'STARTED' })
        .value
    ).toEqual({ running: 'turbo' });
  });
});
