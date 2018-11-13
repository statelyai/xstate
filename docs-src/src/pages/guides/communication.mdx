# Communicating Between Machines

Expressing the entire app's behavior in a single machine can quickly become complex and unwieldy. It is natural (and encouraged!) to use multiple machines that communicate with each other to express complex logic instead. This closely resembles the [Actor model](https://en.wikipedia.org/wiki/Actor_model), where each machine instance is considered an "actor" that can send and receive events (messages) to and from other machine "actors" and react to them.

For machines to communicate, the parent machine **invokes** a child machine and listens to events sent from the child machine via `sendParent(...)`, or waits for the child machine to reach its [final state](/guides/final), which will then cause the `onDone` transition to be taken.

```js
import { Machine, actions } from 'xstate';
import { interpret } from 'xstate/lib/interpreter';
const { send, sendParent } = actions;

const minuteMachine = Machine({
  id: 'timer',
  initial: 'active',
  states: {
    active: {
      after: {
        60000: 'finished'
      }
    },
    finished: { type: 'final' }
  }
});

const parentMachine = Machine({
  id: 'parent',
  initial: 'pending',
  states: {
    pending: {
      invoke: {
        src: minuteMachine,
        onDone: 'timesUp'
      }
    },
    timesUp: {
      type: 'final'
    }
  }
});

const service = interpret(parentMachine)
  .onTransition(state => console.log(state.value))
  .start();
// => 'pending'
// ... after 1 minute
// => 'timesUp'
```

## The `invoke` Property

An invocation is defined in a state node's configuration with the `invoke` property, whose value is an object that contains:

- `src` - the source of the machine to invoke, which can be:
  - a machine
  - a string, which refers to a machine defined in this machine's `options.services`
  - a function that returns a Promise
- `id` - the unique identifier for the invoked service
- `forward` - (optional) `true` if all events sent to this machine should also be sent (or _forwarded_) to the invoked child machine (`false` by default)
- `data` - (optional) an object that maps properties of the child machine's [context](/guides/context) to a function that returns the corresponding value from the parent machine's `context`.
- `onDone` - (optional) the [transition](/guides/transitions) to be taken when the child machine reaches its [final state](/guides/final)
- `onError` - (optional) the transition to be taken when the child machine encounters an execution error.

## Sending Events

Statecharts communicate hierarchically:

- Parent-to-child via the `send(EVENT, { target: 'someChildId' })` action
- Child-to-parent via the `sendParent(EVENT)` action.

Here is an example of two statecharts, `pingMachine` and `pongMachine`, communicating with each other:

```js
import { Machine, actions } from 'xstate';
import { interpret } from 'xstate/lib/interpreter';
const { send, sendParent } = actions;

const pingMachine = Machine({
  id: 'ping',
  initial: 'active',
  states: {
    active: {
      invoke: {
        src: pongMachine,
        id: 'pong'
      }
      onEntry: send('PING', { to: 'pong' }),
      on: {
        PONG: {
          actions: send('PING', {
            to: 'pong',
            delay: 1000
          })
        }
      }
    }
  }
});

const pongMachine = Machine({
  id: 'pong',
  initial: 'active',
  states: {
    active: {
      on: {
        PING: {
          actions: sendParent('PONG', {
            delay: 1000
          })
        }
      }
    }
  }
});

const service = interpret(pingMachine).start();

// => 'ping'
// ...
// => 'pong'
// ..
// => 'ping'
// ...
// => 'pong'
// ...
```

## Invoking Promises

Since every promise can be modeled as a state machine, XState can invoke promises as-is:

```js
// Function that returns a promise
// This promise might resolve with, e.g.,
// { name: 'David', location: 'Florida' }
const fetchUser = userId =>
  fetch(`url/to/user/${userId}`).then(response => response.json());

const userMachine = Machine({
  id: 'user',
  initial: 'idle',
  context: {
    userId: 42,
    user: undefined,
    error: undefined
  },
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {
      invoke: {
        src: (ctx, event) => fetchUser(ctx.userId),
        onDone: {
          target: 'success',
          actions: assign({ user: (ctx, event) => event.data })
        },
        onError: {
          target: 'failure',
          error: (ctx, event) => event.data
        }
      }
    },
    failure: {
      on: {
        RETRY: 'loading'
      }
    }
  }
});
```

The resolved data is placed into a `'done.invoke.<id>'` event, under the `data` property.
