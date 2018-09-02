import { Machine } from '../src/index';

const finalMachine = Machine({
  id: 'final',
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
    red: {
      parallel: true,
      type: 'final',
      states: {
        crosswalk1: {
          initial: 'walk',
          states: {
            walk: {
              on: { PED_WAIT: 'wait' }
            },
            wait: {
              on: { PED_STOP: 'stop' }
            },
            stop: {
              type: 'final'
            }
          }
        },
        crosswalk2: {
          initial: 'walk',
          states: {
            walk: {
              on: { PED_WAIT: 'wait' }
            },
            wait: {
              on: { PED_STOP: 'stop' }
            },
            stop: {
              type: 'final'
            }
          }
        }
      }
    }
  }
});

xdescribe('final states', () => {
  it('should emit the done.state.final.red event when all nested states are finalized', () => {
    const redState = finalMachine.transition('yellow', 'TIMER');
    const waitState = finalMachine.transition(redState, 'PED_WAIT');
    const stopState = finalMachine.transition(waitState, 'PED_STOP');
  });
});
