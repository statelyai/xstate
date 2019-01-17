# State Nodes

A state machine contains state nodes (explained below) that collectively describe the [overall state](./states.md) a machine can be in. In the `fetchMachine` described in the next section, there are **state nodes**, such as:

```js
// ...
{
  states: {
    // state node
    idle: {
      on: {
        FETCH: 'pending';
      }
    }
  }
}
```

And the overall **state**, which is the return value of the `machine.transition()` function or the callback value of `service.onTransition()`:

```js
const nextState = fetchMachine.transition('pending', 'FULFILL');
// State {
//   value: { success: 'items' },
//   actions: [],
//   context: undefined,
//   ...
// }
```

## State nodes

In XState, a **state node** specifies a state configuration, and are defined on the machine's `states` property. Substate nodes are recursively defined in the same way.

The state determined from `machine.transition(state, event)` represents a combination of state nodes. For example, in the machine below, there's a `success` state node and an `items` substate node. The state value `{ success: 'items' }` represents the combination of those state nodes.

```js
const fetchMachine = Machine({
  id: 'fetch',

  // Initial state
  initial: 'idle',

  // States
  states: {
    idle: {
      on: {
        FETCH: 'pending'
      }
    },
    pending: {
      on: {
        FULFILL: 'success',
        REJECT: 'failure'
      }
    },
    success: {
      // Initial child state
      initial: 'items',

      // Child states
      states: {
        items: {
          on: {
            'ITEM.CLICK': 'item'
          }
        },
        item: {
          on: {
            BACK: 'items'
          }
        }
      }
    }
  }
});
```

## State node types

There are five different kinds of state nodes:

- An **atomic** state node has no child states. (I.e., it is a leaf node.)
- A **compound** state node contains one or more child `states`, and has an `initial` state, which is the key of one of those child states.
- A **parallel** state node contains two or more child `states`, and has no initial state, since it represents being in all of its child states at the same time.
- A **final** state node is a leaf node that represents an abstract "terminal" state.
- A **history** state node is an abstract node that represents resolving to its parent node's most recent shallow or deep history state.

The state node type can be explicitly defined on the state node:

```js
const machine = Machine({
  id: 'fetch',
  initial: 'idle',
  states: {
    idle: {
      type: 'atomic',
      on: {
        FETCH: 'pending'
      }
    },
    pending: {
      type: 'parallel',
      states: {
        resource1: {
          type: 'compound',
          initial: 'pending',
          states: {
            pending: {
              on: {
                'FULFILL.resource1': 'success'
              }
            },
            success: {
              type: 'final'
            }
          }
        },
        resource2: {
          type: 'compound',
          initial: 'pending',
          states: {
            pending: {
              on: {
                'FULFILL.resource2': 'success'
              }
            },
            success: {
              type: 'final'
            }
          }
        }
      },
      onDone: 'success'
    },
    success: {
      type: 'compound',
      initial: 'items',
      states: {
        items: {
          on: {
            'ITEM.CLICK': 'item'
          }
        },
        item: {
          on: {
            BACK: 'items'
          }
        },
        hist: {
          type: 'history',
          history: 'shallow'
        }
      }
    }
  }
});
```

Explicitly specifying the `type` as `'atomic'`, `'compound'`, `'parallel'`, `'history'`, or `'final'` is helpful with regard to analysis and type-checking in TypeScript. However, it is only required for parallel, history, and final states.

## Transient state nodes

A transient state node is a "pass-through" state node that immediately transitions to another state node; that is, a machine does not stay in a transient state. Transient state nodes are useful for determining which state the machine should really go to from a previous state based on conditions. They are most similar to [choice pseudostates](https://www.uml-diagrams.org/state-machine-diagrams.html#choice-pseudostate) in UML.

A transient state node only specifies transitions for the [null event](./events.md#null-events) (that is, a [transient transition](./transitions.md#transient-transitions)), which is always immediately raised in that state.

For example, this machine's initial transient state resolves to `'morning'`, `'afternoon'`, or `'evening'`, depending on what time it is (implementation details hidden):

```js
const timeOfDayMachine = Machine({
  id: 'timeOfDay',
  initial: 'unknown',
  context: {
    time: undefined
  },
  states: {
    // Transient state
    unknown: {
      on: {
        '': [
          { target: 'morning', cond: 'isBeforeNoon' },
          { target: 'afternoon', cond: 'isBeforeSix' },
          { target: 'evening' }
        ]
      }
    },
    morning: {},
    afternoon: {},
    evening: {}
  }
}, {
  guards: {
    isBeforeNoon: // ...
    isBeforeSix: // ...
  }
});

const timeOfDayService = interpret(timeOfDayMachine
  .withContext({ time: Date.now() }))
  .onTransition(state => console.log(state.value))
  .start();

// => 'morning' (assuming the time is before noon)
```
