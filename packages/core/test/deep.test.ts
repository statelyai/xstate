import { createMachine } from '../src/index';

describe('deep transitions', () => {
  const deepMachine = createMachine({
    id: 'deep',
    initial: 'A',
    on: {
      MACHINE_EVENT: '#deep.DONE'
    },
    states: {
      DONE: {},
      FAIL: {},
      A: {
        on: {
          A_EVENT: '#deep.DONE',
          B_EVENT: 'FAIL', // shielded by B's B_EVENT
          A_S: '#deep.P.Q.R.S',
          A_P: '#deep.P'
        },
        entry: 'ENTER_A',
        exit: 'EXIT_A',
        initial: 'B',
        states: {
          B: {
            on: {
              B_EVENT: '#deep.DONE'
            },
            entry: 'ENTER_B',
            exit: 'EXIT_B',
            initial: 'C',
            states: {
              C: {
                on: {
                  C_EVENT: '#deep.DONE'
                },
                entry: 'ENTER_C',
                exit: 'EXIT_C',
                initial: 'D',
                states: {
                  D: {
                    on: {
                      D_EVENT: '#deep.DONE',
                      D_S: '#deep.P.Q.R.S',
                      D_P: '#deep.P'
                    },
                    entry: 'ENTER_D',
                    exit: 'EXIT_D'
                  }
                }
              }
            }
          }
        }
      },
      P: {
        on: {
          P_EVENT: '#deep.DONE',
          Q_EVENT: 'FAIL' // shielded by Q's Q_EVENT
        },
        entry: 'ENTER_P',
        exit: 'EXIT_P',
        initial: 'Q',
        states: {
          Q: {
            on: {
              Q_EVENT: '#deep.DONE'
            },
            entry: 'ENTER_Q',
            exit: 'EXIT_Q',
            initial: 'R',
            states: {
              R: {
                on: {
                  R_EVENT: '#deep.DONE'
                },
                entry: 'ENTER_R',
                exit: 'EXIT_R',
                initial: 'S',
                states: {
                  S: {
                    on: {
                      S_EVENT: '#deep.DONE'
                    },
                    entry: 'ENTER_S',
                    exit: 'EXIT_S'
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  describe('exiting super/substates', () => {
    it('should exit all substates when superstates exits (A_EVENT)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'A_EVENT' })
        .actions.map((a) => a.type);
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      expect(actual).toEqual(expected);
    });

    it('should exit substates and superstates when exiting (B_EVENT)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'B_EVENT' })
        .actions.map((a) => a.type);
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      expect(actual).toEqual(expected);
    });

    it('should exit substates and superstates when exiting (C_EVENT)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'C_EVENT' })
        .actions.map((a) => a.type);
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      expect(actual).toEqual(expected);
    });

    it('should exit superstates when exiting (D_EVENT)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'D_EVENT' })
        .actions.map((a) => a.type);
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      expect(actual).toEqual(expected);
    });

    it('should exit substate when machine handles event (MACHINE_EVENT)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'MACHINE_EVENT' })
        .actions.map((a) => a.type);
      const expected = ['EXIT_D', 'EXIT_C', 'EXIT_B', 'EXIT_A'];
      expect(actual).toEqual(expected);
    });

    const DBCAPQRS = [
      'EXIT_D',
      'EXIT_C',
      'EXIT_B',
      'EXIT_A',
      'ENTER_P',
      'ENTER_Q',
      'ENTER_R',
      'ENTER_S'
    ];

    it('should exit deep and enter deep (A_S)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'A_S' })
        .actions.map((a) => a.type);
      const expected = DBCAPQRS;
      expect(actual).toEqual(expected);
    });

    it('should exit deep and enter deep (D_P)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'D_P' })
        .actions.map((a) => a.type);
      const expected = DBCAPQRS;
      expect(actual).toEqual(expected);
    });

    it('should exit deep and enter deep (A_P)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'A_P' })
        .actions.map((a) => a.type);
      const expected = DBCAPQRS;
      expect(actual).toEqual(expected);
    });

    it('should exit deep and enter deep (D_S)', () => {
      const actual = deepMachine
        .transition(deepMachine.initialState, { type: 'D_S' })
        .actions.map((a) => a.type);
      const expected = DBCAPQRS;
      expect(actual).toEqual(expected);
    });
  });
});
