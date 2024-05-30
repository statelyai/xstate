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
 *    - The user provides a description of the state machine they would like
 *      to build.
 *    - Assume the description will be incomplete. First, lay out a happy path
 *      of the sequence of events that will cause transitions, side effects
 *      that will occur, actions that will be invoked, events that will
 *      trigger those actions and transitions, etc.
 *    - Fill in the blanks where there are holes in the user's description by
 *      asking clarifying questions. Establish a full picture of the user's
 *      idea before starting to write code to avoid wasting time.
 *
 * 2. **Test-Driven Development**
 *    - Write tests first based on the clarified requirements.
 *
 * 3. **Define Action Functions**
 *    - Always define action functions with an empty first parameter of type
 *      `any` with parameters that are strongly typed to what your action
 *      function needs.
 *
 * 4. **Declare Machine Context**
 *    - Always declare a machine context as an interface.
 *
 * 5. **Declare Initial Context**
 *    - Declare an initial context of type example initial context, using your
 *      best judgment to name that context outside of the machine.
 *
 * 6. **Define Union Type of Machine Events**
 *    - Define a union type of machine events prefixed by a short domain.
 *      Event types should be lowercase, camel case. If an event has a value
 *      it needs attached, add that value directly to the type. Avoid nested
 *      params.
 *
 * 7. **Use the New Setup API**
 *    - Always use the new setup API as demonstrated in the example machine.
 *      Pass in types for context, events, guards, actors, etc.
 *
 * 8. **Pass in Actions**
 *    - Pass in actions from above. If there are assign actions, define those
 *      inline in the actions block in the setup.
 *
 * 9. **Define Guards**
 *    - Define guards in the setup block, similar to actions, with an
 *      underscore ignored argument as the first argument and strongly typed
 *      parameters for the second argument.
 *
 * 10. **Casing Conventions**
 *     - Events will be lowercase camelcase and will be prefixed by some
 *       domain type to which they belong.
 *     - States will be pascalcase.
 *     - Delays will be pascalcase.
 *     - Actions will be camelcase.
 *     - We will have no screaming snakecase, snakecase, or kebabcase.
 *
 * ---
 *
 * ### Summary
 *
 * To build a state machine with XState version 5 following these instructions,
 * start by gathering and clarifying requirements from the user to ensure a
 * complete understanding of the desired functionality. Write tests first based
 * on the clarified requirements before proceeding to define the state machine.
 * Always define action functions with an empty first parameter of type `any`
 * and strongly typed parameters for the rest. Declare the machine context as
 * an interface and the initial context outside of the machine. Define a union
 * type for machine events with lowercase, camelcase event types. Use the new
 * setup API, passing in types for context, events, guards, actors, etc. Pass
 * in actions, defining inline assign actions in the setup block. Define guards
 * similarly to actions. Follow the specified casing conventions: events in
 * lowercase camelcase with domain prefix, states and delays in pascalcase,
 * and actions in camelcase. Avoid using screaming snakecase, snakecase, or
 * kebabcase. This approach ensures clarity, strong typing, and adherence to
 * best practices in XState version 5.
 * ### XState and TypeScript Integration
 *
 * #### Comprehensive Example
 *
 * The following example demonstrates how all the functionality within XState
 * v5 works, including setting up actions, using dynamic parameters, specifying
 * types, and defining context and event types externally.
 *
 * #### Type Helpers
 *
 * Utilize type helpers provided by XState for strongly-typed references,
 * snapshots, and events:
 *
 * ```typescript
 * import {
 *   type ActorRefFrom,
 *   type SnapshotFrom,
 *   type EventFromLogic
 * } from 'xstate';
 * import { someMachine } from './someMachine';
 *
 * // Strongly-typed actor reference
 * type SomeActorRef = ActorRefFrom<typeof someMachine>;
 *
 * // Strongly-typed snapshot
 * type SomeSnapshot = SnapshotFrom<typeof someMachine>;
 *
 * // Union of all event types
 * type SomeEvent = EventFromLogic<typeof someMachine>;
 * ```
 * ### Additional Instructions
 *
 * If you are unaware of how a specific piece of functionality works, ask for
 * more documentation, specifying exactly what you are curious about.
 *
 * Always write test-driven development (TDD) code. Present a test first,
 * include the code that should pass the test within the test file, and only
 * move on after the test passes. This ensures the code remains simple and
 * refactorable.
 */

import { assign, createActor, setup } from 'xstate';

// Define action implementations
function track(_: any, params: { response: string }) {
  // tslint:disable-next-line:no-console
  console.log(`Tracking response: ${params.response}`);
}

function logInitialRating(_: any, params: { initialRating: number }) {
  // tslint:disable-next-line:no-console
  console.log(`Initial rating: ${params.initialRating}`);
}

function greet(_: any, params: { name: string }) {
  // tslint:disable-next-line:no-console
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
  | { type: 'count.incrementBy'; increment: number }
  | { type: 'count.decrement' };

// Machine setup with strongly typed context and events
const exampleMachine = setup({
  types: {
    context: {} as ExampleMachineContext,
    events: {} as ExampleMachineEvents
  },
  actions: {
    track,
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
    },
    isLessThan: (_, params: { count: number; max: number }) => {
      return params.count < params.max;
    }
  }
}).createMachine({
  context: InitialContext,
  entry: [
    { type: 'track', params: { response: 'good' } },
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
            { type: 'track', params: { response: 'good' } },
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
        ],
        'count.decrement': [
          {
            actions: 'decrement',
            guard: {
              type: 'isLessThan',
              params: ({ context }) => ({ count: context.count, max: 0 })
            },
            target: 'Negative'
          },
          { actions: 'decrement' }
        ]
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

    expect(logSpy).toHaveBeenCalledWith('Tracking response: good');
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

  it('should transition to "Negative" state if count is less than 0', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.decrement' });
    actor.send({ type: 'count.decrement' });
    expect(actor.getSnapshot().matches('Negative')).toBeTruthy();
  });

  it('should stay in "Question" state if no guards are satisfied', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.incrementBy', increment: 5 });
    expect(actor.getSnapshot().matches('Question')).toBeTruthy();
  });
});
