# Guarded Transitions

Many times, you'll want a transition between states to only take place if certain conditions on the state (finite or extended) or the event are met. For instance, let's say you're creating a machine for a search form, and you only want search to be allowed if:

- the user is allowed to search (`.canSearch` in this example)
- the search event `query` is not empty.

This is a good use case for a "guarded transition", which is a transition that only occurs if some condition (`cond`) passes. A transition with condition(s) is called a **guarded transition**.

## Serializing Guards

Guards can (and should) be serialized as a string or an object with the `{ type: '...' }` property. The implementation details of the guard are specified on the `guards` property of the machine options, where the `key` is the guard `type` (specified as a string or object) and the value is a function that takes three arguments:

- `context` - the current machine context
- `event` - the event that triggered the (potential) transition
- `guardMeta` - an object containing meta data about the guard and transition, including:
  - `cond` - the original `cond` object
  - `state` - the current machine state, before transition

Refactoring the above example:

```js {9-11,19-23}
const searchMachine = createMachine(
  {
    // ...
    states: {
      idle: {
        on: {
          SEARCH: {
            target: 'searching',
            // The 'searchValid' guard implementation details are
            // specified in the machine config
            cond: 'searchValid' // or { type: 'searchValid' }
          }
        }
      }
      // ...
    }
  },
  {
    guards: {
      searchValid: (context, event) => {
        return context.canSearch && event.query && event.query.length > 0;
      }
    }
  }
);
```

## Custom Guards <Badge text="4.4+"/>

Sometimes, it is preferable to not only serialize state transitions in JSON, but guard logic as well. This is where serializing guards as objects is helpful, as objects may contain relevant data:

```js {9-13,21-30}
const searchMachine = createMachine(
  {
    // ...
    states: {
      idle: {
        on: {
          SEARCH: {
            target: 'searching',
            // Custom guard object
            cond: {
              type: 'searchValid',
              minQueryLength: 3
            }
          }
        }
      }
      // ...
    }
  },
  {
    guards: {
      searchValid: (context, event, { cond }) => {
        // cond === { type: 'searchValid', minQueryLength: 3 }
        return (
          context.canSearch &&
          event.query &&
          event.query.length > cond.minQueryLength
        );
      }
    }
  }
);
```

## Multiple Guards

If you want to have a single event transition to different states in certain situations you can supply an array of conditional transitions. Each transition will be tested in order, and the first transition whose `cond` guard evaluates to `true` will be taken.

For example, you can model a door that listens for an `OPEN` event, goes to the `'opened'` state if you are an admin, or goes to the `'closed.error'` state if `alert`-ing is true, or goes to the `'closed.idle'` state otherwise.

```js {25-27}
import { createMachine, actions, interpret, assign } from 'xstate';

const doorMachine = createMachine(
  {
    id: 'door',
    initial: 'closed',
    context: {
      level: 'user',
      alert: false // alert when intrusions happen
    },
    states: {
      closed: {
        initial: 'idle',
        states: {
          idle: {},
          error: {}
        },
        on: {
          SET_ADMIN: {
            actions: assign({ level: 'admin' })
          },
          SET_ALARM: {
            actions: assign({ alert: true })
          },
          OPEN: [
            // Transitions are tested one at a time.
            // The first valid transition will be taken.
            { target: 'opened', cond: 'isAdmin' },
            { target: '.error', cond: 'shouldAlert' },
            { target: '.idle' }
          ]
        }
      },
      opened: {
        on: {
          CLOSE: { target: 'closed' }
        }
      }
    }
  },
  {
    guards: {
      isAdmin: (context) => context.level === 'admin',
      shouldAlert: (context) => context.alert === true
    }
  }
);

const doorService = interpret(doorMachine)
  .onTransition((state) => console.log(state.value))
  .start();
// => { closed: 'idle' }

doorService.send({ type: 'OPEN' });
// => { closed: 'idle' }

doorService.send({ type: 'SET_ALARM' });
// => { closed: 'idle' }
// (state does not change, but context changes)

doorService.send({ type: 'OPEN' });
// => { closed: 'error' }

doorService.send({ type: 'SET_ADMIN' });
// => { closed: 'error' }
// (state does not change, but context changes)

doorService.send({ type: 'OPEN' });
// => 'opened'
// (since context.isAdmin === true)
```

<iframe src="https://stately.ai/viz/embed/?gist=8526f72c3041b38f7d7ba808c812df06"></iframe>

::: warning
The `cond` function must always be a **pure function** that only references the `context` and `event` arguments.
:::

::: tip
Do _not_ overuse guard conditions. If something can be represented discretely as two or more separate events instead of multiple `conds` on a single event, it is preferable to avoid `cond` and use multiple types of events instead.
:::

## "In State" Guards

The `in` property takes a state ID as an argument and returns `true` if and only if that state node is active in the current state. For example, we can add a guard to the traffic light machine:

```js {24}
const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: { target: 'yellow' }
      }
    },
    yellow: {
      on: {
        TIMER: { target: 'red' }
      }
    },
    red: {
      initial: 'walk',
      states: {
        walk: {
          /* ... */
        },
        wait: {
          /* ... */
        },
        stop: {
          /* ... */
        }
      },
      on: {
        TIMER: [
          {
            target: 'green',
            in: '#light.red.stop'
          }
        ]
      }
    }
  }
});
```

When an `in`-state guard is present with other `cond` guards in the same transition, _all_ guards must evaluate to `true` for the transition to be taken.

::: tip
Using "in state" guards is usually a sign that the machine can be refactored in a way that makes their usage unnecessary. Prefer avoiding "in state" guards when possible.
:::
