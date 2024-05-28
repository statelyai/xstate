You have access to extensive training data on XState version 4. However, XState version 5 has been universally released with significant breaking changes. Follow these guidelines for XState version 5 unless explicitly stated otherwise by the user:

### XState and TypeScript Integration

#### Comprehensive Example

The following example demonstrates how all the functionality within XState v5 works, including setting up actions, using dynamic parameters, specifying types, and defining context and event types externally.

##### Action Functions

Define action functions separately:

```typescript
function track(_: any, params: { response: string }) {
  console.log(`Tracking response: ${params.response}`);
}

function increment(_: any, params: { value: number }) {
  console.log(`Incrementing by: ${params.value}`);
}

function logInitialRating(_: any, params: { initialRating: number }) {
  console.log(`Initial rating: ${params.initialRating}`);
}

function greet(_: any, params: { name: string }) {
  console.log(`Hello, ${params.name}!`);
}
```

##### Initial Context

Define the initial context as a constant:

```typescript
type FeedbackMachineContext = {
  feedback: string;
  initialRating: number;
  user: { name: string };
};

const InitialContext: FeedbackMachineContext = {
  feedback: '',
  initialRating: 3,
  user: { name: 'David' }
};
```

##### State Machine Setup

Set up the state machine with strongly typed context and events, including the actions inline:

```typescript
import { setup, type ActionFunction } from 'xstate';

// Define event types
type FeedbackMachineEvents =
  | { type: 'feedback.good' }
  | { type: 'feedback.bad' };

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
        }
      }
    }
  }
});
```

#### Type Helpers

Utilize type helpers provided by XState for strongly-typed references, snapshots, and events:

```typescript
import {
  type ActorRefFrom,
  type SnapshotFrom,
  type EventFromLogic
} from 'xstate';
import { someMachine } from './someMachine';

// Strongly-typed actor reference
type SomeActorRef = ActorRefFrom<typeof someMachine>;

// Strongly-typed snapshot
type SomeSnapshot = SnapshotFrom<typeof someMachine>;

// Union of all event types
type SomeEvent = EventFromLogic<typeof someMachine>;
```

#### Cheat Sheet: Provide Implementations

```typescript
import { createMachine } from 'xstate';
import { someMachine } from './someMachine';

const machineWithImpls = someMachine.provide({
  actions: {
    /* ... */
  },
  actors: {
    /* ... */
  },
  guards: {
    /* ... */
  },
  delays: {
    /* ... */
  }
});
```

### Additional Instructions

If you are unaware of how a specific piece of functionality works, ask for more documentation, specifying exactly what you are curious about.

Always write test-driven development (TDD) code. Present a test first, include the code that should pass the test within the test file, and only move on after the test passes. This ensures the code remains simple and refactorable.
