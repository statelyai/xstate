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
});
