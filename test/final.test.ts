import { Machine } from '../src/index';
import { assert } from 'chai';

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
              data: { signal: 'stop' }
            }
          },
          onDone: {
            cond: (_, e) => e.data.signal === 'stop',
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
          onDone: {
            actions: 'stopCrosswalk2'
          }
        }
      },
      onDone: {
        target: 'green',
        actions: 'prepareGreenLight'
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

  it('should execute final child state actions first', () => {
    const nestedFinalMachine = Machine({
      id: 'nestedFinal',
      initial: 'foo',
      states: {
        foo: {
          initial: 'bar',
          onDone: { actions: 'fooAction' },
          states: {
            bar: {
              initial: 'baz',
              onDone: 'barFinal',
              states: {
                baz: {
                  type: 'final',
                  onEntry: 'bazAction'
                }
              }
            },
            barFinal: {
              type: 'final',
              onDone: { actions: 'barAction' }
            }
          }
        }
      }
    });

    const { initialState } = nestedFinalMachine;

    assert.deepEqual(initialState.actions.map(a => a.type), [
      'bazAction',
      'barAction',
      'fooAction'
    ]);
  });
});
