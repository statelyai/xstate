## XState Cheatsheet

### Creating a machine

```js
import { createMachine } from 'xstate';

const machine = createMachine({
  // Machine identifier
  id: "Statechart",
  // Context (extended state)
  context: {
    count: 42
  },
  // Initial state
  initial: "Atomic",
  // States
  states: {
    // Atomic state
    Atomic: {
      // Transitions
      on: {
        // Transition (shorthand - target only)
        next: "Compound",
      },
    },
    // Compound state (has child states)
    Compound: {
      initial: "One",
      states: {
        // Atomic state (child state)
        One: {
          on: {
            // Transition object (target only)
            // Same as `next: "Two"`
            next: { target: "Two" }
          }
        },
        Two: {
          on: {
            previous: { target: "One" }
          }
        },
        // History state
        History: {
          type: "history"
        }
      },
      on: {
        skip: { target: "Parallel" }
      },
    },
    // Parallel state
    Parallel: {
      type: "parallel",
      states: {
        // Region (parallel child state)
        RegionA: {
          initial: "One",
          states: {
            One: {
              on: { "a.next": "Two" },
            },
            // Final state
            Two: { type: "final" },
          },
        },
        RegionB: {
          initial: "One",
          states: {
            One: {
              on: { "b.next": "Two" },
            },
            Two: { type: "final" },
          },
        },
      },
      on: {
        // Transition to sibling child state
        back: "Compound.History",
      },
      // Done transition
      // Taken when all regions reach their final states
      onDone: "Final",
    },
    // Top-level final state
    // Stops the machine
    Final: {
      type: "final",
    },
  },
});
```

## Interpreting a machine
```ts
import { createMachine, interpret } from 'xstate';

const machine = createMachine({/* ... */});

const actor = interpret(machine);

// Subscribe to each state update
const sub = actor.subscribe(state => {
  console.log(state);
});

// Unsubscribe
sub.unsubscribe();

// Start the actor
actor.start();
```

## Actions
```ts
const machine = createMachine({
  id: "Actions",
  initial: "First",
  states: {
    First: {
      // Single entry action (shorthand)
      entry: 'someEntryAction',
      // Exit actions
      exit: ['someExitAction', 'anotherExitAction'],
      on: {
        someEvent: {
          // Transition actions
          actions: [
            // String action reference (shorthand - no params)
            'stringAction',
            // Object action reference (with params)
            { type: 'objectAction', params: { count: 42 } },
            // Inline action function
            (context, event) => {
              console.log('Inline action')
            }
          ],
          target: 'Second'
        }
      }
    },
    Second: {
      // From `First` to `Second` on `someEvent`, the order of actions will be:
      // 1. Exit actions of `First` state
      // 2. Transition actions of `someEvent` transition
      // 3. Entry actions of `Second` state
      entry: 'otherEntryAction'
    }
  }
}, {
  actions: {
    // Action implementation
    someEntryAction: (context, event) => {/* ... */},
    objectAction: (context, event, { action }) => {
      console.log(action.params); // { count: 42 }
    }
  }
});
```

## Guards

```ts
const machine = createMachine({
  id: "Guards",
  context: { count: 100 },
  initial: "First",
  states: {
    First: {
      on: {
        someEvent: [
          // Transition that will only be taken if 'isValid' guard evaluates to `true`
          {
            cond: 'isValid',
            target: 'Second'
          },
          // Default transition (no guard)
          { target: 'Other' }
        ]
      }
    },
    Second: {
      // Eventless transition
      always: [
        {
          // Guard object with parameters
          cond: { type: 'isGreaterThan', params: { count: 42 } },
          target: 'Third'
        }
      ]
    },
    Third: {
      on: {
        anotherEvent: {
          // Inline guard function
          cond: (context, event) => {/* Some condition (`true` or `false`) */},
          actions: (context, event) => {
            // Action only executed if guard evaluates to `true`
          }
        }
      }
    }
  }
}, {
  guards: {
    isValid: (context, event) => {
      return context.count === 100;
    },
    isGreaterThan: (context, event, { guard }) => {
      return context.count > guard.params.count;
    }
  }
});
```