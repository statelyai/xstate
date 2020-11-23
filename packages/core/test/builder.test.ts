import { buildMachine } from '../src/builder';

describe('builder', () => {
  it('builds a machine', () => {
    const lightMachine = buildMachine('light', (machine) => {
      machine.initialState('green', (state) => {
        state.on('TIMER', 'yellow');
      });

      machine.state('yellow', (state) => {
        state.on('TIMER', 'red');
      });

      machine.state('red', (state) => {
        state.initialState('walk', (walkState) => {
          walkState.on('COUNTDOWN', 'wait');
        });

        state.state('wait', (waitState) => {
          waitState.on('COUNTDOWN', 'stop');
        });

        state.state('stop');

        state.on('TIMER', 'green');
      });
    });

    expect(
      lightMachine.transition(undefined, 'TIMER').matches('yellow')
    ).toBeTruthy();
    expect(
      lightMachine.transition('yellow', 'TIMER').matches({ red: 'walk' })
    ).toBeTruthy();
    expect(
      lightMachine.transition('red', 'COUNTDOWN').matches({ red: 'wait' })
    ).toBeTruthy();
  });

  it('works with entry actions', () => {
    const testMachine = buildMachine('test', (m) => {
      m.initialState('inactive', (s) => {
        s.on('NEXT', 'active');
      });
      m.state('active', (s) => {
        s.entry('someAction');
      });
    });

    const activeState = testMachine.transition(undefined, 'NEXT');

    expect(activeState.actions.map((a) => a.type)).toEqual(['someAction']);
  });

  it('works with exit actions', () => {
    const testMachine = buildMachine('test', (m) => {
      m.initialState('inactive', (s) => {
        s.on('NEXT', 'active');
        s.exit('someAction');
      });
      m.state('active');
    });

    const activeState = testMachine.transition(undefined, 'NEXT');

    expect(activeState.actions.map((a) => a.type)).toEqual(['someAction']);
  });

  it('works with transition actions', () => {
    const testMachine = buildMachine('test', (m) => {
      m.initialState('inactive', (s) => {
        s.on('NEXT', (t) => {
          t.action('someAction');

          return 'active';
        });
      });
      m.state('active');
    });

    const activeState = testMachine.transition(undefined, 'NEXT');

    expect(activeState.actions.map((a) => a.type)).toEqual(['someAction']);
  });

  it('works with guarded transitions', () => {
    const testMachine = buildMachine('test', (m) => {
      m.initialState('inactive', (s) => {
        s.on('EVENT', (t) => t.when(() => false, 'active'));
      });

      m.state('active');
    });

    const activeState = testMachine.transition(undefined, 'NEXT');

    expect(activeState.matches('inactive')).toBeTruthy();
  });
});
