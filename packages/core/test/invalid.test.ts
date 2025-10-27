import { next_createMachine, transition } from '../src/index.ts';

describe('invalid or resolved states', () => {
  it('should resolve a String state', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {},
            A2: {}
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {}
          }
        }
      }
    });
    expect(
      transition(machine, machine.resolveState({ value: 'A' }), {
        type: 'E'
      })[0].value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should resolve transitions from empty states', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {},
            A2: {}
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {}
          }
        }
      }
    });
    expect(
      transition(machine, machine.resolveState({ value: { A: {}, B: {} } }), {
        type: 'E'
      })[0].value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should allow transitioning from valid states', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {},
            A2: {}
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {}
          }
        }
      }
    });
    transition(machine, machine.resolveState({ value: { A: 'A1', B: 'B1' } }), {
      type: 'E'
    });
  });

  it('should reject transitioning from bad state configs', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {},
            A2: {}
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {}
          }
        }
      }
    });
    expect(() =>
      transition(
        machine,
        machine.resolveState({ value: { A: 'A3', B: 'B3' } }),
        { type: 'E' }
      )
    ).toThrow();
  });

  it('should resolve transitioning from partially valid states', () => {
    const machine = next_createMachine({
      type: 'parallel',
      states: {
        A: {
          initial: 'A1',
          states: {
            A1: {},
            A2: {}
          }
        },
        B: {
          initial: 'B1',
          states: {
            B1: {},
            B2: {}
          }
        }
      }
    });
    expect(
      transition(machine, machine.resolveState({ value: { A: 'A1', B: {} } }), {
        type: 'E'
      })[0].value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });
});

describe('invalid transition', () => {
  it('should throw when attempting to create a machine with a sibling target on the root node', () => {
    expect(() => {
      next_createMachine({
        id: 'direction',
        initial: 'left',
        states: {
          left: {},
          right: {}
        },
        on: {
          LEFT_CLICK: 'left',
          RIGHT_CLICK: 'right'
        }
      });
    }).toThrow(/invalid target/i);
  });
});
