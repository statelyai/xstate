/**
 * ## SITUATION
 * You have access to extensive training data on XState version 4. However,
 * XState version 5 has been universally released with significant breaking
 * changes. Follow these guidelines for XState version 5 unless explicitly
 * stated otherwise by the user:
 *
 * ## INSTRUCTIONS
 *
 * 1. **Gather Requirements and Clarify**
 *    - Obtain a description of the state machine from the user, assuming
 *      it will be incomplete. Lay out a happy path of events causing
 *      transitions, side effects, actions, and triggers. Fill in gaps by
 *      asking clarifying questions to establish a full picture before
 *      starting to code.
 *
 * 2. **Test-Driven Development**
 *    - Write tests first based on the clarified requirements, using the
 *      simulated clock strategy instead of Jest's simulated clock.
 *
 * 3. **Define Action Functions**
 *    - Define action functions with an empty first parameter of type `any`
 *      and strongly typed parameters.
 *
 * 4. **Declare Context and Initial Context**
 *    - Declare a machine context as an interface and define an initial
 *      context outside of the machine using your best judgment for naming.
 *
 * 5. **Define Union Type of Machine Events**
 *    - Create a union type of machine events prefixed by a short domain,
 *      using lowercase camelCase for event types. Attach event values
 *      directly to the type, avoiding nested params.
 *
 * 6. **Use the New Setup API**
 *    - Use the new setup API as demonstrated in the example machine,
 *      passing in types for context, events, guards, actors, etc.
 *
 * 7. **Pass in Actions and Define Inline Assign Actions**
 *    - Pass in actions, defining inline assign actions in the setup block.
 *
 * 8. **Define Guards**
 *    - Define guards in the setup block with an underscore ignored argument
 *      as the first argument and strongly typed parameters for the second.
 *
 * 9. **Casing Conventions**
 *    - Events: lowercase camelCase, prefixed by domain type.
 *    - States and Delays: PascalCase.
 *    - Actions: camelCase.
 *    - Avoid using screaming snakecase, snakecase, or kebabcase.
 */

import { assign, createActor, setup, SimulatedClock } from 'xstate';

function logInitialRating(_: any, params: { initialRating: number }) {
  console.log(`Initial rating: ${params.initialRating}`);
}

function greet(_: any, params: { name: string }) {
  console.log(`Hello, ${params.name}!`);
}

interface ExampleMachineContext {
  feedback: string;
  initialRating: number;
  user: { name: string };
  count: number;
}

const InitialContext: ExampleMachineContext = {
  feedback: '',
  initialRating: 3,
  user: { name: 'David' },
  count: 0
} as const;

// Define event types
type ExampleMachineEvents =
  | { type: 'feedback.good' }
  | { type: 'feedback.bad' }
  | { type: 'count.increment' }
  | { type: 'count.incrementBy'; increment: number };

// Machine setup with strongly typed context and events
const exampleMachine = setup({
  types: {
    context: {} as ExampleMachineContext,
    events: {} as ExampleMachineEvents
  },
  actions: {
    logInitialRating,
    greet,
    increment: assign({
      count: ({ context }) => {
        return context.count + 1;
      }
    }),
    decrement: assign({ count: ({ context }) => context.count - 1 }),
    incrementBy: assign({
      count: ({ context }, params: { increment: number }) => {
        const result = context.count + params.increment;
        return result;
      }
    })
  },
  guards: {
    isGreaterThan: (_, params: { count: number; min: number }) => {
      return params.count > params.min;
    }
  },
  delays: {
    testDelay: 10_000
  }
}).createMachine({
  context: InitialContext,
  entry: [
    {
      type: 'logInitialRating',
      params: ({ context }) => ({ initialRating: context.initialRating })
    },
    {
      type: 'greet',
      params: ({ context }) => ({ name: context.user.name })
    }
  ],
  initial: 'Question',
  states: {
    Question: {
      on: {
        'feedback.good': {
          actions: [
            {
              type: 'logInitialRating',
              params: ({ context }) => ({
                initialRating: context.initialRating
              })
            },
            {
              type: 'greet',
              params: ({ context }) => ({ name: context.user.name })
            }
          ]
        },
        'count.increment': [
          {
            actions: 'increment',
            guard: {
              type: 'isGreaterThan',
              params: ({ context }) => ({ count: context.count, min: 5 })
            },
            target: 'Greater'
          },
          {
            actions: 'increment'
          }
        ],
        'count.incrementBy': [
          {
            actions: {
              type: 'incrementBy',
              params: ({ event }) => ({
                increment: event.increment
              })
            },
            guard: {
              type: 'isGreaterThan',
              params: ({ context }) => ({ count: context.count, min: 5 })
            },
            target: 'Greater'
          },
          {
            actions: {
              type: 'incrementBy',
              params: ({ event }) => ({
                increment: event.increment
              })
            }
          }
        ]
      },
      after: {
        testDelay: 'TimedOut'
      }
    },
    Greater: {
      type: 'final'
    },
    Less: {
      type: 'final'
    },
    Negative: {
      type: 'final'
    },
    TimedOut: {
      type: 'final'
    }
  }
});

// Type tests to ensure type satisfaction
import {
  type ActorRefFrom,
  type SnapshotFrom,
  type EventFromLogic
} from 'xstate';

// Strongly-typed actor reference
type SomeActorRef = ActorRefFrom<typeof exampleMachine>;
// @ts-expect-error
const invalidActorRef: SomeActorRef = { invalid: true }; // Should produce a type error
const validActorRef: SomeActorRef = createActor(exampleMachine); // Should be valid

// Strongly-typed snapshot
type SomeSnapshot = SnapshotFrom<typeof exampleMachine>;
// @ts-expect-error
const invalidSnapshot: SomeSnapshot = { invalid: true }; // Should produce a type error
const validSnapshot: SomeSnapshot = validActorRef.getSnapshot(); // Should be valid

// Union of all event types
type SomeEvent = EventFromLogic<typeof exampleMachine>;
// @ts-expect-error
const invalidEvent: SomeEvent = { invalid: true }; // Should produce a type error
const validEvent: SomeEvent = { type: 'feedback.good' }; // Should be valid

describe('exampleMachine', () => {
  it('should log initial rating and greet user on entry', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    createActor(exampleMachine).start();

    expect(logSpy).toHaveBeenCalledWith('Initial rating: 3');
    expect(logSpy).toHaveBeenCalledWith('Hello, David!');

    logSpy.mockRestore();
  });

  it('should transition to "Greater" state if count is greater than 5', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.incrementBy', increment: 6 });
    actor.send({ type: 'count.incrementBy', increment: 6 });
    expect(actor.getSnapshot().context.count).toEqual(12);
    expect(actor.getSnapshot().matches('Greater')).toBeTruthy();
  });

  it('should stay in "Question" state if no guards are satisfied', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.incrementBy', increment: -5 });
    expect(actor.getSnapshot().context.count).toEqual(-5);
    expect(actor.getSnapshot().matches('Question')).toBeTruthy();
  });

  it('should transition to "TimedOut" state after delay', () => {
    const clock = new SimulatedClock();
    const actor = createActor(exampleMachine, {
      clock
    }).start();

    expect(actor.getSnapshot().value).toEqual('Question');

    clock.increment(10_000);

    expect(actor.getSnapshot().value).toEqual('TimedOut');
  });
});
