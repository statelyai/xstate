import { assert } from 'chai';
import { Machine } from '../src/index';

describe('guard conditions', () => {
  // type LightMachineEvents =
  //   | { type: 'TIMER'; elapsed: number }
  //   | { type: 'EMERGENCY'; isEmergency: boolean };

  const lightMachine = Machine<{ elapsed: number }>(
    {
      key: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: [
              {
                target: 'green',
                cond: ({ elapsed }) => elapsed < 100
              },
              {
                target: 'yellow',
                cond: ({ elapsed }) => elapsed >= 100 && elapsed < 200
              }
            ],
            EMERGENCY: {
              target: 'red',
              cond: (_, event) => event.isEmergency
            }
          }
        },
        yellow: {
          on: {
            TIMER: {
              target: 'red',
              cond: 'minTimeElapsed'
            },
            TIMER_COND_OBJ: {
              target: 'red',
              cond: {
                type: 'minTimeElapsed'
              }
            }
          }
        },
        red: {
          on: {
            BAD_COND: { target: 'red', cond: 'doesNotExist' }
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
      lightMachine.transition('green', 'TIMER', {
        elapsed: 50
      }).value,
      'green'
    );

    assert.deepEqual(
      lightMachine.transition('green', 'TIMER', {
        elapsed: 120
      }).value,
      'yellow'
    );
  });

  it('should transition if condition based on event is met', () => {
    assert.deepEqual(
      lightMachine.transition('green', { type: 'EMERGENCY', isEmergency: true })
        .value,
      'red'
    );
  });

  it('should not transition if condition based on event is not met', () => {
    assert.deepEqual(
      lightMachine.transition('green', { type: 'EMERGENCY' }).value,
      'green'
    );
  });

  it('should not transition if no condition is met', () => {
    const nextState = lightMachine.transition('green', 'TIMER', {
      elapsed: 9000
    });
    assert.deepEqual(nextState.value, 'green');
    assert.isEmpty(nextState.actions);
  });

  it('should work with defined string transitions', () => {
    const nextState = lightMachine.transition('yellow', 'TIMER', {
      elapsed: 150
    });
    assert.equal(nextState.value, 'red');
  });

  it('should work with guard objects', () => {
    const nextState = lightMachine.transition('yellow', 'TIMER_COND_OBJ', {
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

describe('guard conditions', () => {
  const machine = Machine({
    key: 'microsteps',
    type: 'parallel',
    states: {
      A: {
        initial: 'A0',
        states: {
          A0: {
            on: {
              A: 'A1'
            }
          },
          A1: {
            on: {
              A: 'A2'
            }
          },
          A2: {
            on: {
              A: 'A3'
            }
          },
          A3: {
            on: {
              '': 'A4'
            }
          },
          A4: {
            on: {
              '': 'A5'
            }
          },
          A5: {}
        }
      },
      B: {
        initial: 'B0',
        states: {
          B0: {
            on: {
              T1: [
                {
                  target: 'B1',
                  cond: (_state, _event, { state: s }) => s.matches('A.A1')
                }
              ],
              T2: [
                {
                  target: 'B2',
                  cond: (_state, _event, { state: s }) => s.matches('A.A2')
                }
              ],
              T3: [
                {
                  target: 'B3',
                  cond: (_state, _event, { state: s }) => s.matches('A.A3')
                }
              ],
              '': [
                {
                  target: 'B4',
                  cond: (_state, _event, { state: s }) => s.matches('A.A4')
                }
              ]
            }
          },
          B1: {},
          B2: {},
          B3: {},
          B4: {}
        }
      }
    }
  });

  it('should guard against transition', () => {
    assert.deepEqual(machine.transition({ A: 'A2', B: 'B0' }, 'T1').value, {
      A: 'A2',
      B: 'B0'
    });
  });

  it('should allow a matching transition', () => {
    assert.deepEqual(machine.transition({ A: 'A2', B: 'B0' }, 'T2').value, {
      A: 'A2',
      B: 'B2'
    });
  });

  it('should check guards with interim states', () => {
    assert.deepEqual(machine.transition({ A: 'A2', B: 'B0' }, 'A').value, {
      A: 'A5',
      B: 'B4'
    });
  });
});

describe('custom guards', () => {
  const machine = Machine(
    {
      id: 'custom',
      initial: 'inactive',
      context: {
        count: 0
      },
      states: {
        inactive: {
          on: {
            EVENT: {
              target: 'active',
              cond: {
                type: 'custom',
                prop: 'count',
                op: 'greaterThan',
                compare: 3
              }
            }
          }
        },
        active: {}
      }
    },
    {
      guards: {
        custom: (ctx, e, meta) => {
          const { prop, compare, op } = meta.cond as any; // TODO: fix
          if (op === 'greaterThan') {
            return ctx[prop] + e.value > compare;
          }

          return false;
        }
      }
    }
  );

  it('should evaluate custom guards', () => {
    const passState = machine.transition(machine.initialState, {
      type: 'EVENT',
      value: 4
    });

    assert.equal(passState.value, 'active');

    const failState = machine.transition(machine.initialState, {
      type: 'EVENT',
      value: 3
    });

    assert.equal(failState.value, 'inactive');
  });
});
