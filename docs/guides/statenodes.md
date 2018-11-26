# State Nodes

A state is an abstract representation of a system (such as an application) at a specific point in time. As an application is interacted with, events cause it to change state.

A state machine contains state nodes (explained below) that collectively describe the overall state a machine can be in. In the `fetchMachine` described in the next section, there are **state nodes**, such as:

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

## State Nodes

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
  id: 'fetch'
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
      initial: 'allItems',
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
