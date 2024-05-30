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

interface FeedbackMachineContext {
  feedback: string;
  initialRating: number;
  user: { name: string };
}

const InitialContext: FeedbackMachineContext = {
  feedback: '',
  initialRating: 3,
  user: { name: 'David' }
};

// Define event types
type FeedbackMachineEvents =
  | { type: 'feedback.good' }
  | { type: 'feedback.bad' }
  | { type: 'count.increment'; count: number }
  | { type: 'count.decrement'; count: number };

// Machine setup with strongly typed context and events
const feedbackMachine = setup({
  types: {
    context: {} as FeedbackMachineContext,
    events: {} as FeedbackMachineEvents
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
type SomeActorRef = ActorRefFrom<typeof feedbackMachine>;
// @ts-expect-error
const invalidActorRef: SomeActorRef = { invalid: true }; // Should produce a type error
const validActorRef: SomeActorRef = createActor(feedbackMachine); // Should be valid

// Strongly-typed snapshot
type SomeSnapshot = SnapshotFrom<typeof feedbackMachine>;
// @ts-expect-error
const invalidSnapshot: SomeSnapshot = { invalid: true }; // Should produce a type error
const validSnapshot: SomeSnapshot = validActorRef.getSnapshot(); // Should be valid

// Union of all event types
type SomeEvent = EventFromLogic<typeof feedbackMachine>;
// @ts-expect-error
const invalidEvent: SomeEvent = { invalid: true }; // Should produce a type error
const validEvent: SomeEvent = { type: 'feedback.good' }; // Should be valid

describe('feedbackMachine', () => {
  it('should log initial rating and greet user on entry', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    const actor = createActor(feedbackMachine).start();

    expect(logSpy).toHaveBeenCalledWith('Tracking response: good');
    expect(logSpy).toHaveBeenCalledWith('Incrementing by: 1');
    expect(logSpy).toHaveBeenCalledWith('Initial rating: 3');
    expect(logSpy).toHaveBeenCalledWith('Hello, David!');

    logSpy.mockRestore();
  });

  it('should transition to "greater" state if count is greater than 5', () => {
    const actor = createActor(feedbackMachine).start();

    actor.send({ type: 'count.increment', count: 6 });
    expect(actor.getSnapshot().matches('greater')).toBeTruthy();
  });

  it('should transition to "less" state if count is less than 5', () => {
    const actor = createActor(feedbackMachine).start();

    actor.send({ type: 'count.increment', count: 4 });
    expect(actor.getSnapshot().matches('less')).toBeTruthy();
  });

  it('should transition to "negative" state if count is less than 0', () => {
    const actor = createActor(feedbackMachine).start();

    actor.send({ type: 'count.decrement', count: -1 });
    expect(actor.getSnapshot().matches('negative')).toBeTruthy();
  });

  it('should stay in "question" state if no guards are satisfied', () => {
    const actor = createActor(feedbackMachine).start();

    actor.send({ type: 'count.increment', count: 5 });
    expect(actor.getSnapshot().matches('question')).toBeTruthy();
  });

  it('should transition to "less" state if count is less than 5', () => {
    const actor = createActor(feedbackMachine).start();

    // Send an increment event to transition to the greater state
    actor.send({ type: 'count.increment', count: 6 });
    expect(actor.getSnapshot().matches('greater')).toBeTruthy();

    // Expectation before stopping the actor
    expect(actor.getSnapshot().value).toEqual('greater');

    // Create a new actor instance
    const extendedActor = createActor(feedbackMachine).start();

    // Ensure the new actor starts in the initial state 'question'
    expect(extendedActor.getSnapshot().matches('question')).toBeTruthy();

    // Send an increment event to transition to the less state
    extendedActor.send({ type: 'count.increment', count: 4 });
    expect(extendedActor.getSnapshot().matches('less')).toBeTruthy();
  });
});
