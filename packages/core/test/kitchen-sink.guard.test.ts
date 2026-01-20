/*
 Documentation for Guards:

 Guards
 A guard is a condition function that the machine checks when it goes through an event. If the condition is true, the machine follows the transition to the next state. If the condition is false, the machine follows the rest of the conditions to the next state.

 A guarded transition is a transition that is enabled only if its guard evaluates to true. The guard determines whether or not the transition can be enabled. Any transition can be a guarded transition.

 Guards and TypeScript
 XState v5 requires TypeScript version 5.0 or greater.

 For best results, use the latest TypeScript version. Read more about XState and TypeScript

 You MUST strongly type the guards of your machine by setting up their implementations in setup({ guards: { … } }). You can provide the params type in the 2nd argument of the guard function:

 import { setup } from 'xstate';

 const machine = setup({
 guards: {
 isGreaterThan: (_, params: { count: number; min: number; }) => {
 return params.count > params.min;
 }
 }
 }).createMachine({
 // ...
 on: {
 someEvent: {
 guard: {
 type: 'isGreaterThan',
 // Strongly-typed params
 params: ({ event }) => ({
 count: event.count,
 min: 10
 })
 },
 // ...
 },
 },
 });

 Multiple guarded transitions
 If you want to have a single event transition to different states in certain situations, you can supply an array of guarded transitions. Each transition will be tested in order, and the first transition whose guard evaluates to true will be taken.

 Guard object
 A guard can be defined as an object with a type, which is the type of guard that references the provided guard implementation, and optional params, which can be read by the implemented guard.

 Guards can later be provided or overridden by providing custom guard implementations in the .provide() method.

 Higher-level guards
 XState provides higher-level guards, which are guards that compose other guards. There are three higher-level guards – and, or, and not:

 and([...]) - evaluates to true if all guards in and([...guards]) evaluate to true
 or([...]) - evaluates to true if any guards in or([...guards]) evaluate to true
 not(...) - evaluates to true if the guard in not(guard) evaluates to false

 In-state guards
 You can use the stateIn(stateValue) guard to check if the current state matches the provided stateValue. This is most useful for parallel states.
 */

import { createActor, setup } from '../src/index.ts';
import { and, not, or, stateIn } from '../src/guards';

describe('comprehensive guard conditions', () => {
  interface MachineContext {
    elapsed: number;
    count: number;
  }
  type MachineEvents =
    | { type: 'TIMER'; elapsed: number }
    | { type: 'EMERGENCY'; isEmergency?: boolean }
    | { type: 'EVENT'; value: number }
    | { type: 'TIMER_COND_OBJ' }
    | { type: 'TEST' }
    | { type: 'GO_TO_ACTIVE' }
    | { type: 'BAD_COND' };

  const machine = setup({
    types: {} as {
      input: { elapsed?: number; count?: number };
      context: MachineContext;
      events: MachineEvents;
    },
    guards: {
      minTimeElapsed: (_, params: { elapsed: number }) =>
        params.elapsed >= 100 && params.elapsed < 200,
      custom: (
        _,
        params: { compare: number; op: string; value: number; prop: number }
      ) => {
        const { prop, compare, op, value } = params;
        if (op === 'greaterThan') {
          return prop + value > compare;
        }
        return false;
      },
      isCountHigh: (_, params: { count: number }) => params.count > 5,
      isElapsedHigh: (_, params: { elapsed: number }) => params.elapsed > 150,
      isEmergency: (_, params: { isEmergency: boolean }) => !!params.isEmergency
    }
  }).createMachine({
    context: ({ input = {} }) => ({
      elapsed: input.elapsed ?? 0,
      count: input.count ?? 0
    }),
    initial: 'green',
    states: {
      green: {
        on: {
          GO_TO_ACTIVE: {
            target: 'active'
          },
          TIMER: [
            {
              target: 'green',
              guard: ({ context: { elapsed } }) => ({
                type: 'minTimeElapsed',
                params: { elapsed }
              })
            },
            {
              target: 'yellow',
              guard: { type: 'minTimeElapsed', params: { elapsed: 150 } }
            }
          ],
          EMERGENCY: {
            target: 'red',
            guard: { type: 'isEmergency', params: { isEmergency: true } }
          }
        }
      },
      yellow: {
        on: {
          TIMER: {
            target: 'red',
            guard: { type: 'minTimeElapsed', params: { elapsed: 150 } }
          },
          TIMER_COND_OBJ: {
            target: 'red',
            guard: {
              type: 'minTimeElapsed',
              params: { elapsed: 150 }
            }
          }
        }
      },
      red: {
        type: 'final'
      },
      active: {
        on: {
          EVENT: {
            target: 'inactive',
            guard: {
              type: 'custom',
              params: ({ context, event }) => ({
                prop: 2,
                op: 'greaterThan',
                compare: 3,
                value: event.value
              })
            }
          }
        }
      },
      inactive: {}
    }
  });

  it('should transition if custom guard condition is met', () => {
    const actorRef = createActor(machine, { input: { count: 2 } }).start();
    actorRef.send({ type: 'GO_TO_ACTIVE' });
    actorRef.send({ type: 'EVENT', value: 2 });
    expect(actorRef.getSnapshot().value).toEqual('inactive');
  });

  it('should not transition if custom guard condition is not met', () => {
    const actorRef = createActor(machine, { input: { count: 1 } }).start();
    actorRef.send({ type: 'GO_TO_ACTIVE' });
    expect(actorRef.getSnapshot().value).toEqual('active');
    actorRef.send({ type: 'EVENT', value: 1 });
    expect(actorRef.getSnapshot().value).toEqual('active');
  });

  it('should guard with higher-level guards', () => {
    const highLevelMachine = setup({
      types: {} as {
        input: { elapsed?: number; count?: number };
        context: MachineContext;
        events: MachineEvents;
      },
      guards: {
        isCountHigh: (_, params: { count: number }) => params.count > 5,
        isElapsedHigh: (_, params: { elapsed: number }) => params.elapsed > 150
      }
    }).createMachine({
      context: ({ input = {} }) => ({
        elapsed: input.elapsed ?? 0,
        count: input.count ?? 0
      }),
      initial: 'start',
      states: {
        start: {
          on: {
            TEST: {
              target: 'success',
              guard: and([
                { type: 'isCountHigh', params: { count: 6 } },
                { type: 'isElapsedHigh', params: { elapsed: 160 } }
              ])
            }
          }
        },
        success: {}
      }
    });

    const actorRef = createActor(highLevelMachine, {
      input: { count: 6, elapsed: 160 }
    }).start();
    actorRef.send({ type: 'TEST' });
    expect(actorRef.getSnapshot().value).toEqual('success');
  });

  it('should guard with in-state guards', () => {
    const inStateMachine = setup({
      types: {} as {
        input: { elapsed?: number; count?: number };
        context: MachineContext;
        events: MachineEvents;
      }
    }).createMachine({
      context: ({ input = {} }) => ({
        elapsed: input.elapsed ?? 0,
        count: input.count ?? 0
      }),
      type: 'parallel',
      states: {
        A: {
          initial: 'A2',
          states: {
            A0: {},
            A2: {
              on: {
                A: 'A3'
              }
            },
            A3: {
              always: 'A4'
            },
            A4: {
              always: 'A5'
            },
            A5: {}
          }
        },
        B: {
          initial: 'B0',
          states: {
            B0: {
              always: [
                {
                  target: 'B4',
                  guard: stateIn('A.A4')
                }
              ]
            },
            B4: {}
          }
        }
      }
    });

    const actorRef = createActor(inStateMachine).start();
    actorRef.send({ type: 'A' });
    expect(actorRef.getSnapshot().value).toEqual({
      A: 'A5',
      B: 'B4'
    });
  });
});
