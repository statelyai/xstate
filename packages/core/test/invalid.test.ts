import { createMachine } from '../src/index.ts';

describe('invalid or resolved states', () => {
  it('should resolve a String state', () => {
    const machine = createMachine({
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
      machine.transition(
        machine.resolveState({ value: 'A' }),
        { type: 'E' },
        {} as any // TODO: figure out the simulation API
      ).value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should resolve transitions from empty states', () => {
    const machine = createMachine({
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
      machine.transition(
        machine.resolveState({ value: { A: {}, B: {} } }),
        { type: 'E' },
        {} as any // TODO: figure out the simulation API
      ).value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should allow transitioning from valid states', () => {
    const machine = createMachine({
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
    machine.transition(
      machine.resolveState({ value: { A: 'A1', B: 'B1' } }),
      { type: 'E' },
      {} as any // TODO: figure out the simulation API
    );
  });

  it('should reject transitioning from bad state configs', () => {
    const machine = createMachine({
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
      machine.transition(
        machine.resolveState({ value: { A: 'A3', B: 'B3' } }),
        { type: 'E' },
        {} as any // TODO: figure out the simulation API
      )
    ).toThrow();
  });

  it('should resolve transitioning from partially valid states', () => {
    const machine = createMachine({
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
      machine.transition(
        machine.resolveState({ value: { A: 'A1', B: {} } }),
        { type: 'E' },
        {} as any // TODO: figure out the simulation API
      ).value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });
});

describe('invalid transition', () => {
  it('should throw when attempting to create a machine with a sibling target on the root node', () => {
    expect(() => {
      createMachine({
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
    }).toThrowError(/invalid target/i);
  });
});
