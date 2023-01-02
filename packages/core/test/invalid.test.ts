import { createMachine } from '../src/index';

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

describe('invalid or resolved states', () => {
  it('should resolve a String state', () => {
    expect(machine.transition('A', { type: 'E' }).value).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should resolve transitions from empty states', () => {
    expect(machine.transition({ A: {}, B: {} }, { type: 'E' }).value).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should allow transitioning from valid states', () => {
    machine.transition({ A: 'A1', B: 'B1' }, { type: 'E' });
  });

  it('should reject transitioning from bad state configs', () => {
    expect(() =>
      machine.transition({ A: 'A3', B: 'B3' }, { type: 'E' })
    ).toThrow();
  });

  it('should resolve transitioning from partially valid states', () => {
    expect(machine.transition({ A: 'A1', B: {} }, { type: 'E' }).value).toEqual(
      {
        A: 'A1',
        B: 'B1'
      }
    );
  });
});
