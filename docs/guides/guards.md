# Guards (Conditional Transitions)

Many times, you'll want a transition between states to only take place if certain conditions on the state (finite or extended) or the event are met. For instance, let's say you're creating a machine for a search form, and you only want search to be allowed if:

- the user is allowed to search (`.canSearch` in this example)
- the search event `query` is not empty.

This is a good use case for a "transition guard", which determines if a transition can occur given the state and the event. A **guard** is a function that takes 2 arguments:

- `context` - the [machine context](./context.md)
- `event` - the event, represented as an object

and returns either `true` or `false`, which signifies whether the transition should be allowed to take place.

Guards are specified on the `.cond` property of a transition, as a string or guard object with a `{ type: '...' }` property:

```js {15-16,30-34}
import { Machine } from 'xstate';

const searchMachine = Machine(
  {
    id: 'search',
    initial: 'idle',
    context: {
      canSearch: true
    },
    states: {
      idle: {
        on: {
          SEARCH: {
            target: 'searching',
            // Only transition to 'searching' if the guard (cond) evaluates to true
            cond: 'searchValid' // or { type: 'searchValid' }
          }
        }
      },
      searching: {
        onEntry: 'executeSearch'
        // ...
      },
      searchError: {
        // ...
      }
    }
  },
  {
    guards: {
      searchValid: (ctx, event) => {
        return ctx.canSearch && event.query && event.query.length > 0;
      }
    }
  }
);
```

If the `cond` guard returns `false`, then the transition will not be selected, and no transition will take place from that state node.

Example of usage with context:

```js
import { interpret } from 'xstate';

const searchService = interpret(searchMachine)
  .onTransition(state => console.log(state.value))
  .start();

searchService.send({ type: 'SEARCH', query: '' });
// => 'idle'

searchService.send({ type: 'SEARCH', query: 'something' });
// => 'searching'
```

::: tip
Guard implementations can be quickly prototyped by specifying the guard `cond` function directly in the machine config:

```js {4}
// ...
SEARCH: {
  target: 'searching',
  cond: (ctx, event) => ctx.canSearch && event.query && event.query.length > 0
}
// ...
```

It is _not recommended_ to keep the machine config like this in production code, as this makes it difficult to debug, serialize, test, and accurately visualize actions. Always prefer refactoring inline guard implementations in the `guards` property of the machine options, like the previous example.
:::

## Serializing Guards

Guards can (and should) be serialized as a string or an object with the `{ type: '...' }` property. The implementation details of the guard are specified on the `guards` property of the machine options, where the `key` is the guard `type` (specified as a string or object) and the value is a function that takes three arguments:

- `ctx` - the current machine context
- `event` - the event that triggered the (potential) transition
- `guardMeta` - (since 4.4) an object containing meta data about the guard and transition, including:
  - `cond` - the original `cond` object
  - `state` - the current machine state, before transition

Refactoring the above example:

```js {9-11,19-23}
const searchMachine = Machine(
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
      searchValid: (ctx, event) => {
        return ctx.canSearch && event.query && event.query.length > 0;
      }
    }
  }
);
```

## Custom Guards

(since 4.4)

Sometimes, it is preferable to not only serialize state transitions in JSON, but guard logic as well. This is where serializing guards as objects is helpful, as objects may contain relevant data:

```js {9-13,21-30}
const searchMachine = Machine(
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
      searchValid: (ctx, event, { cond }) => {
        // cond === { type: 'searchValid', minQueryLength: 3 }
        return (
          ctx.canSearch &&
          event.query &&
          event.query.length > cond.minQueryLength
        );
      }
    }
  }
);
```

## Multiple Guards

If you want to have a single event transition to different states in certain situations you can supply an array of conditional transitions.

For example, you can model a door that listens for an `OPEN` event, goes to the `'opened'` state if you are an admin, and goes to the `'closed.error'` state if you are not:

```js {20-23}
import { Machine, actions, interpret, assign } from 'xstate';

const doorMachine = Machine({
  id: 'door',
  initial: 'closed',
  context: {
    isAdmin: false
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
          actions: assign({ isAdmin: true })
        },
        OPEN: [
          { target: 'opened', cond: ctx => ctx.isAdmin },
          { target: '.error' }
        ]
      }
    },
    opened: {
      on: {
        CLOSE: 'closed'
      }
    }
  }
});

const doorService = interpret(doorMachine)
  .onTransition(state => console.log(state.value))
  .start();
// => { closed: 'idle' }

doorService.send('OPEN');
// => { closed: 'error' }

doorService.send('SET_ADMIN');
// => { closed: 'error' }
// (state does not change, but context changes)

doorService.send('OPEN');
// => 'opened'
// (since ctx.isAdmin === true)
```

**Notes:**

- The `cond` function must always be a pure function that only references the `context` and `event` arguments.

::: warning
Do _not_ overuse guard conditions. If something can be represented discretely as two or more separate events instead of multiple `conds` on a single event, it is preferable to avoid `cond` and use multiple types of events instead.
:::

## "In State" Guards

The `in` property takes a state ID as an argument and returns `true` if and only if that state node is active in the current state. For example, we can add a guard to the traffic light machine:

```js {24}
const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: { on: { TIMER: 'yellow' } },
    yellow: { on: { TIMER: 'red' } },
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

## SCXML

The `cond` property is equivalent to the `cond` attribute on the `<transition>` element:

```js
{
  on: {
    e: {
      target: 'foo',
      cond: ctx => ctx.x === 1
    }
  }
}
```

```xml
<transition event="e" cond="x == 1" target="foo" />
```

Likewise, the `in` property is equivalent to the `In()` predicate:

```js
{
  on: {
    e: {
      target: 'cooking',
      in: '#closed'
    }
  }
}
```

```xml
<transition cond="In('closed')" target="cooking"/>
```

- [https://www.w3.org/TR/scxml/#transition](https://www.w3.org/TR/scxml/#transition) - the definition of the `cond` attribute
- [https://www.w3.org/TR/scxml/#ConditionalExpressions](https://www.w3.org/TR/scxml/#ConditionalExpressions) - conditional expressions and the requirement of supporting the `In()` predicate
- [https://www.w3.org/TR/scxml/#SelectingTransitions](https://www.w3.org/TR/scxml/#SelectingTransitions) - how transitions are selected given an event
