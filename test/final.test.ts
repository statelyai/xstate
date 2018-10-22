import { Machine } from '../src/index';
import { assert } from 'chai';
import { done } from '../src/actions';

// @ts-ignore
const finalMachine = Machine({
  id: 'final',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: { on: { TIMER: 'red' } },
    red: {
      type: 'parallel',
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
              type: 'final',
              data: 'stop'
            }
          },
          onDone: {
            actions: 'stopCrosswalk1'
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
              on: { PED_STOP: 'stop2' }
            },
            stop2: {
              type: 'final'
            }
          },
          on: {
            [done('final.red.crosswalk2')]: {
              actions: 'stopCrosswalk2'
            }
          }
        }
      },
      on: {
        [done('final.red') + '']: {
          actions: 'prepareGreenLight'
        }
      }
    }
  },
  onDone: {
    // this action should never occur because final states are not direct children of machine
    actions: 'shouldNeverOccur'
  }
});

describe('final states', () => {
  it('should emit the "done.state.final.red" event when all nested states are in their final states', () => {
    const redState = finalMachine.transition('yellow', 'TIMER');
    const waitState = finalMachine.transition(redState, 'PED_WAIT');
    const stopState = finalMachine.transition(waitState, 'PED_STOP');

    assert.sameDeepMembers(stopState.actions, [
      { type: 'stopCrosswalk1', exec: undefined }
    ]);

    const stopState2 = finalMachine.transition(stopState, 'PED_STOP');

    assert.sameDeepMembers(stopState2.actions, [
      { type: 'stopCrosswalk2', exec: undefined },
      { type: 'prepareGreenLight', exec: undefined }
    ]);

    const greenState = finalMachine.transition(stopState, 'TIMER');
    assert.isEmpty(greenState.actions);
  });
});
