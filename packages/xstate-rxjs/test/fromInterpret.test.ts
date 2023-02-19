import { createMachine } from 'xstate';
import { fromInterpret } from '../src';

const originalConsoleWarn = console.warn;

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describe('fromInterpret', () => {
  it('observer should be called with initial state', (done) => {
    const machine = createMachine({
      predictableActionArguments: true,
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const { state$ } = fromInterpret(machine);

    state$.subscribe((state) => {
      expect(state.matches('inactive')).toBeTruthy();
      done();
    });
  });

  it('observer should be called with next state', (done) => {
    const machine = createMachine({
      predictableActionArguments: true,
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const { state$, send } = fromInterpret(machine);
    state$.subscribe((state) => {
      if (state.matches('active')) {
        done();
      }
    });

    send('ACTIVATE');
  });
});
