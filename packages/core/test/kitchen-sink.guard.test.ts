import { createActor, createMachine, setup } from '../src/index.ts';
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
    | { type: 'BAD_COND' };

  const machine = setup({
    types: {} as {
      input: { elapsed?: number; count?: number };
      context: MachineContext;
      events: MachineEvents;
    },
    guards: {
      minTimeElapsed: ({ context: { elapsed } }) =>
        elapsed >= 100 && elapsed < 200,
      custom: (
        _: any,
        params: {
          compare: number;
          op: string;
          value: number;
          prop: number;
        }
      ) => {
        const { prop, compare, op, value } = params;
        if (op === 'greaterThan') {
          return prop + value > compare;
        }
        return false;
      }
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
          TIMER: [
            {
              target: 'green',
              guard: ({ context: { elapsed } }) => elapsed < 100
            },
            {
              target: 'yellow',
              guard: ({ context: { elapsed } }) =>
                elapsed >= 100 && elapsed < 200
            }
          ],
          EMERGENCY: {
            target: 'red',
            guard: ({ event }) => !!event.isEmergency
          }
        }
      },
      yellow: {
        on: {
          TIMER: {
            target: 'red',
            guard: 'minTimeElapsed'
          },
          TIMER_COND_OBJ: {
            target: 'red',
            guard: {
              type: 'minTimeElapsed'
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
                prop: context.count,
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

  it('should transition only if condition is met', () => {
    const actorRef1 = createActor(machine, { input: { elapsed: 50 } }).start();
    actorRef1.send({ type: 'TIMER', elapsed: 50 });
    expect(actorRef1.getSnapshot().value).toEqual('green');

    const actorRef2 = createActor(machine, { input: { elapsed: 120 } }).start();
    actorRef2.send({ type: 'TIMER', elapsed: 120 });
    expect(actorRef2.getSnapshot().value).toEqual('yellow');
  });
});

/*

Guards
A guard is a condition function that the machine checks when it goes through an event. If the condition is true, the machine follows the transition to the next state. If the condition is false, the machine follows the rest of the conditions to the next state.

A guarded transition is a transition that is enabled only if its guard evaluates to true. The guard determines whether or not the transition can be enabled. Any transition can be a guarded transition.

You can easily visualize and simulate guarded transitions in Stately’s editor. Read more about guards in Stately’s editor.

Guards should be pure, synchronous functions that return either true or false.

const feedbackMachine = createMachine(
  {
    // ...
    states: {
      form: {
        on: {
          'feedback.submit': {
            guard: 'isValid',
            target: 'submitting',
          },
        },
      },
      submitting: {
        // ...
      },
    },
  },
  {
    guards: {
      isValid: ({ context }) => {
        return context.feedback.length > 0;
      },
    },
  },
);


Multiple guarded transitions
If you want to have a single event transition to different states in certain situations, you can supply an array of guarded transitions. Each transition will be tested in order, and the first transition whose guard evaluates to true will be taken.

You can specify a default transition to be taken as the last transition in the array. If none of the guards evaluate to true, the default transition will be taken.

const feedbackMachine = createMachine({
  // ...
  prompt: {
    on: {
      'feedback.provide': [
        // Taken if 'sentimentGood' guard evaluates to `true`
        {
          guard: 'sentimentGood',
          target: 'thanks',
        },
        // Taken if none of the above guarded transitions are taken
        // and if 'sentimentBad' guard evaluates to `true`
        {
          guard: 'sentimentBad',
          target: 'form',
        },
        // Default transition
        { target: 'form' },
      ],
    },
  },
});


Guard object
A guard can be defined as an object with a type, which is the type of guard that references the provided guard implementation, and optional params, which can be read by the implemented guard:

const feedbackMachine = createMachine(
  {
    // ...
    states: {
      // ...
      form: {
        on: {
          submit: {
            guard: { type: 'isValid', params: { maxLength: 50 } },
            target: 'submitting',
          },
        },
      },
      // ...
    },
  },
  {
    guards: {
      isValid: ({ context }, params) => {
        return (
          context.feedback.length > 0 &&
          context.feedback.length <= params.maxLength
        );
      },
    },
  },
);


Guards can later be provided or overridden by providing custom guard implementations in the .provide() method:

const feedbackActor = createActor(
  feedbackMachine.provide({
    guards: {
      isValid: ({ context }, params) => {
        return (
          context.feedback.length > 0 &&
          context.feedback.length <= params.maxLength &&
          isNotSpam(context.feedback)
        );
      },
    },
  }),
).start();

Higher-level guards
XState provides higher-level guards, which are guards that compose other guards. There are three higher-level guards – and, or, and not:

and([...]) - evaluates to true if all guards in and([...guards]) evaluate to true
or([...]) - evaluates to true if any guards in or([...guards]) evaluate to true
not(...) - evaluates to true if the guard in not(guard) evaluates to false
on: {
  event: {
    guard: and(['isValid', 'isAuthorized']);
  }
}

Higher-level guards can be combined:

on: {
  event: {
    guard: and(['isValid', or(['isAuthorized', 'isGuest'])]);
  }
}

In-state guards
You can use the stateIn(stateValue) guard to check if the current state matches the provided stateValue. This is most useful for parallel states.

on: {
  event: {
    guard: stateIn('#state1');
  },
  anotherEvent: {
    guard: stateIn({ form: 'submitting' })
  }
}

 */
