/**
 * You have access to extensive training data on XState version 4. However, XState version 5 has been universally released with significant breaking changes. Follow these guidelines for XState version 5 unless explicitly stated otherwise by the user:
 *
 * ### XState and TypeScript Integration
 *
 * #### Comprehensive Example
 *
 * The following example demonstrates how all the functionality within XState v5 works, including setting up actions, using dynamic parameters, specifying types, and defining context and event types externally.
 *
 * #### Type Helpers
 *
 * Utilize type helpers provided by XState for strongly-typed references, snapshots, and events:
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
 *
 * #### Cheat Sheet: Provide Implementations
 *
 * ```typescript
 * import { createMachine } from 'xstate';
 * import { someMachine } from './someMachine';
 *
 * const machineWithImpls = someMachine.provide({
 *   actions: {
 *     ...
 *   },
 *   actors: {
 *     ...
 *   },
 *   guards: {
 *     ...
 *   },
 *   delays: {
 *     ...
 *   }
 * });
 * ```
 *
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

import { createActor, setup } from 'xstate';

// Define action implementations
function track(_: any, params: { response: string }) {
  // tslint:disable-next-line:no-console
  console.log(`Tracking response: ${params.response}`);
}

function increment(_: any, params: { value: number }) {
  // tslint:disable-next-line:no-console
  console.log(`Incrementing by: ${params.value}`);
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
}

const InitialContext: ExampleMachineContext = {
  feedback: '',
  initialRating: 3,
  user: { name: 'David' }
};

// Define event types
type ExampleMachineEvents =
  | { type: 'feedback.good' }
  | { type: 'feedback.bad' }
  | { type: 'count.increment'; count: number }
  | { type: 'count.decrement'; count: number };

// Machine setup with strongly typed context and events
const exampleMachine = setup({
  types: {
    context: {} as ExampleMachineContext,
    events: {} as ExampleMachineEvents
  },
  actions: {
    track,
    increment,
    logInitialRating,
    greet
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
    { type: 'increment', params: { value: 1 } },
    {
      type: 'logInitialRating',
      params: ({ context }) => ({ initialRating: context.initialRating })
    },
    {
      type: 'greet',
      params: ({ context }) => ({ name: context.user.name })
    }
  ],
  initial: 'question',
  states: {
    question: {
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
            guard: {
              type: 'isGreaterThan',
              params: ({ event }) => ({ count: event.count, min: 5 })
            },
            target: 'greater'
          },
          {
            guard: {
              type: 'isLessThan',
              params: ({ event }) => ({ count: event.count, max: 5 })
            },
            target: 'less'
          }
        ],
        'count.decrement': {
          guard: {
            type: 'isLessThan',
            params: ({ event }) => ({ count: event.count, max: 0 })
          },
          target: 'negative'
        }
      }
    },
    greater: {
      type: 'final'
    },
    less: {
      type: 'final'
    },
    negative: {
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

    const actor = createActor(exampleMachine).start();

    expect(logSpy).toHaveBeenCalledWith('Tracking response: good');
    expect(logSpy).toHaveBeenCalledWith('Incrementing by: 1');
    expect(logSpy).toHaveBeenCalledWith('Initial rating: 3');
    expect(logSpy).toHaveBeenCalledWith('Hello, David!');

    logSpy.mockRestore();
  });

  it('should transition to "greater" state if count is greater than 5', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.increment', count: 6 });
    expect(actor.getSnapshot().matches('greater')).toBeTruthy();
  });

  it('should transition to "less" state if count is less than 5', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.increment', count: 4 });
    expect(actor.getSnapshot().matches('less')).toBeTruthy();
  });

  it('should transition to "negative" state if count is less than 0', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.decrement', count: -1 });
    expect(actor.getSnapshot().matches('negative')).toBeTruthy();
  });

  it('should stay in "question" state if no guards are satisfied', () => {
    const actor = createActor(exampleMachine).start();

    actor.send({ type: 'count.increment', count: 5 });
    expect(actor.getSnapshot().matches('question')).toBeTruthy();
  });

  it('should transition to "less" state if count is less than 5', () => {
    const actor = createActor(exampleMachine).start();

    // Send an increment event to transition to the greater state
    actor.send({ type: 'count.increment', count: 6 });
    expect(actor.getSnapshot().matches('greater')).toBeTruthy();

    // Expectation before stopping the actor
    expect(actor.getSnapshot().value).toEqual('greater');

    // Create a new actor instance
    const extendedActor = createActor(exampleMachine).start();

    // Ensure the new actor starts in the initial state 'question'
    expect(extendedActor.getSnapshot().matches('question')).toBeTruthy();

    // Send an increment event to transition to the less state
    extendedActor.send({ type: 'count.increment', count: 4 });
    expect(extendedActor.getSnapshot().matches('less')).toBeTruthy();
  });
});
