# States

A state is an abstract representation of a system (such as an application) at a specific point in time. To learn more, read the [section on states in our introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md#states).

## API

The current state of a machine is represented by a `State` instance:

```js {13-18,21-26}
const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      /* ... */
    }
    // ...
  }
});

console.log(lightMachine.initialState);
// State {
//   value: 'green',
//   actions: [],
//   context: undefined,
//   // ...
// }

console.log(lightMachine.transition('yellow', { type: 'TIMER' }));
// State {
//   value: { red: 'walk' },
//   actions: [],
//   context: undefined,
//   // ...
// }
```

## State definition

A `State` object instance is JSON-serializable and has the following properties:

- `value` - the current state value (e.g., `{red: 'walk'}`)
- `context` - the current [context](./context.md) of this state
- `event` - the event object that triggered the transition to this state
- `actions` - an array of [actions](./actions.md) to be executed
- `activities` - a mapping of [activities](./activities.md) to `true` if the activity started, or `false` if stopped.
- `history` - the previous `State` instance
- `meta` - any static meta data defined on the `meta` property of the [state node](./statenodes.md)
- `done` - whether the state indicates a final state

The `State` object also contains other properties such as `historyValue`, `events`, `tree` and others that are generally not relevant and are used internally.

## State methods and properties

There are some helpful methods and properties you can use for a better development experience:

### `state.matches(parentStateValue)`

The `state.matches(parentStateValue)` method determines whether the current `state.value` is a subset of the given `parentStateValue`. The method determines if the parent state value “matches” the state value. For example, assuming the current `state.value` is `{ red: 'stop' }`:

```js
console.log(state.value);
// => { red: 'stop' }

console.log(state.matches('red'));
// => true

console.log(state.matches('red.stop'));
// => true

console.log(state.matches({ red: 'stop' }));
// => true

console.log(state.matches('green'));
// => false
```

::: tip
If you want to match one of multiple states, you can use [`.some()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some) on an array of state values to accomplish this:

```js
const isMatch = [{ customer: 'deposit' }, { customer: 'withdrawal' }].some(
  state.matches
);
```

:::

### `state.nextEvents`

`state.nextEvents` specifies the next events that will cause a transition from the current state:

```js
const { initialState } = lightMachine;

console.log(initialState.nextEvents);
// => ['TIMER', 'EMERGENCY']
```

`state.nextEvents` is useful in determining which next events can be taken, and representing these potential events in the UI such as enabling/disabling certain buttons.

### `state.changed`

`state.changed` specifies if this `state` has changed from the previous state. A state is considered “changed” if:

- Its value is not equal to its previous value, or:
- It has any new actions (side-effects) to execute.

An initial state (with no history) will return `undefined`.

```js
const { initialState } = lightMachine;

console.log(initialState.changed);
// => undefined

const nextState = lightMachine.transition(initialState, { type: 'TIMER' });

console.log(nextState.changed);
// => true

const unchangedState = lightMachine.transition(nextState, {
  type: 'UNKNOWN_EVENT'
});

console.log(unchangedState.changed);
// => false
```

### `state.done`

`state.done` specifies whether the `state` is a [“final state”](./final.md) - a final state is a state that indicates that its machine has reached its final (terminal) state and can no longer transition to any other state.

```js
const answeringMachine = createMachine({
  initial: 'unanswered',
  states: {
    unanswered: {
      on: {
        ANSWER: { target: 'answered' }
      }
    },
    answered: {
      type: 'final'
    }
  }
});

const { initialState } = answeringMachine;
initialState.done; // false

const answeredState = answeringMachine.transition(initialState, {
  type: 'ANSWER'
});
answeredState.done; // true
```

### `state.toStrings()`

The `state.toStrings()` method returns an array of strings that represent _all_ of the state value paths. For example, assuming the current `state.value` is `{ red: 'stop' }`:

```js
console.log(state.value);
// => { red: 'stop' }

console.log(state.toStrings());
// => ['red', 'red.stop']
```

The `state.toStrings()` method is useful for representing the current state in string-based environments, such as in CSS classes or data-attributes.

### `state.children`

`state.children` is an object mapping spawned service/actor IDs to their instances. See [📖 Referencing Services](./communication.md#referencing-services) for more details.

#### Example using `state.children`

```js
const machine = createMachine({
  // ...
  invoke: [
    { id: 'notifier', src: createNotifier },
    { id: 'logger', src: createLogger }
  ]
  // ...
});

const service = invoke(machine)
  .onTransition((state) => {
    state.children.notifier; // service from createNotifier()
    state.children.logger; // service from createLogger()
  })
  .start();
```

### `state.hasTag(tag)`

_Since 4.19.0_

The `state.hasTag(tag)` method determines whether the current state configuration has a state node with the given tag.

```js {5,8,11}
const machine = createMachine({
  initial: 'green',
  states: {
    green: {
      tags: 'go' // single tag
    },
    yellow: {
      tags: 'go'
    },
    red: {
      tags: ['stop', 'other'] // multiple tags
    }
  }
});
```

For instance, if the above machine is in the `green` or `yellow` state, instead of matching the state directly using `state.matches('green') || state.matches('yellow')`, it is possible to use `state.hasTag('go')`:

```js
const canGo = state.hasTag('go');
// => `true` if in 'green' or 'yellow' state
```

### `state.can(event)`

_Since 4.25.0_

The `state.can(event)` method determines whether an `event` will cause a state change if sent to the interpreted machine. The method will return `true` if the state will change due to the `event` being sent; otherwise the method will return `false`:

```js
const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        DO_SOMETHING: { actions: ['something'] }
      }
    }
  }
});

const inactiveState = machine.initialState;

inactiveState.can('TOGGLE'); // true
inactiveState.can('DO_SOMETHING'); // false

// Also takes in full event objects:
inactiveState.can({
  type: 'DO_SOMETHING',
  data: 42
}); // false

const activeState = machine.transition(inactiveState, 'TOGGLE');

activeState.can('TOGGLE'); // false
activeState.can('DO_SOMETHING'); // true, since an action will be executed
```

A state is considered “changed” if [`state.changed`](#state-changed) is `true` and if any of the following are true:

- its `state.value` changes
- there are new `state.actions` to be executed
- its `state.context` changes.

## Persisting state

As mentioned, a `State` object can be persisted by serializing it to a string JSON format:

```js
const jsonState = JSON.stringify(currentState);

// Example: persisting to localStorage
try {
  localStorage.setItem('app-state', jsonState);
} catch (e) {
  // unable to save to localStorage
}
```

State can be restored using the static `State.create(...)` method:

```js
import { State, interpret } from 'xstate';
import { myMachine } from '../path/to/myMachine';

// Retrieving the state definition from localStorage, if localStorage is empty use machine initial state
const stateDefinition =
  JSON.parse(localStorage.getItem('app-state')) || myMachine.initialState;

// Use State.create() to restore state from a plain object
const previousState = State.create(stateDefinition);
```

You can then interpret the machine from this state by passing the `State` into the `.start(...)` method of the interpreted service:

```js
// ...

// This will start the service at the specified State
const service = interpret(myMachine).start(previousState);
```

This will also maintain and restore previous [history states](./history.md) and ensures that `.events` and `.nextEvents` represent the correct values.

::: warning
Persisting spawned [actors](./actors.md) isn't yet supported in XState.
:::

## State meta data

Meta data, which is static data that describes relevant properties of any [state node](./statenodes.md), can be specified on the `.meta` property of the state node:

```js {17-19,22-24,30-32,35-37,40-42}
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  states: {
    idle: {
      on: { FETCH: { target: 'loading' } }
    },
    loading: {
      after: {
        3000: 'failure.timeout'
      },
      on: {
        RESOLVE: { target: 'success' },
        REJECT: { target: 'failure' },
        TIMEOUT: { target: 'failure.timeout' } // manual timeout
      },
      meta: {
        message: 'Loading...'
      }
    },
    success: {
      meta: {
        message: 'The request succeeded!'
      }
    },
    failure: {
      initial: 'rejection',
      states: {
        rejection: {
          meta: {
            message: 'The request failed.'
          }
        },
        timeout: {
          meta: {
            message: 'The request timed out.'
          }
        }
      },
      meta: {
        alert: 'Uh oh.'
      }
    }
  }
});
```

The current state of the machine collects the `.meta` data of all of the state nodes, represented by the state value, and places them on an object where:

- The keys are the [state node IDs](./ids.md)
- The values are the state node `.meta` values

For instance, if the above machine is in the `failure.timeout` state (which is represented by two state nodes with IDs `"failure"` and `"failure.timeout"`), the `.meta` property will combine all `.meta` values as follows:

```js {4-11}
const failureTimeoutState = fetchMachine.transition('loading', {
  type: 'TIMEOUT'
});

console.log(failureTimeoutState.meta);
// => {
//   failure: {
//     alert: 'Uh oh.'
//   },
//   'failure.timeout': {
//     message: 'The request timed out.'
//   }
// }
```

::: tip TIP: Aggregating meta data
What you do with meta data is up to you. Ideally, meta data should contain JSON-serializable values _only_. Consider merging/aggregating the meta data differently. For example, the following function discards the state node ID keys (if they are irrelevant) and merges the meta data:

```js
function mergeMeta(meta) {
  return Object.keys(meta).reduce((acc, key) => {
    const value = meta[key];

    // Assuming each meta value is an object
    Object.assign(acc, value);

    return acc;
  }, {});
}

const failureTimeoutState = fetchMachine.transition('loading', {
  type: 'TIMEOUT'
});

console.log(mergeMeta(failureTimeoutState.meta));
// => {
//   alert: 'Uh oh.',
//   message: 'The request timed out.'
// }
```

:::

## Notes

- You should never have to create a `State` instance manually. Treat `State` as a read-only object that _only_ comes from `machine.transition(...)` or `service.onTransition(...)`.
- `state.history` will not retain its history in order to prevent memory leaks. `state.history.history === undefined`. Otherwise, you end up creating a huge linked list and reinventing blockchain, which we don't care to do.
  - This behavior may be configurable in future versions.
