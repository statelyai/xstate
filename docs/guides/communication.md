# Invoking Services

Expressing the entire app's behavior in a single machine can quickly become complex and unwieldy. It is natural (and encouraged!) to use multiple machines that communicate with each other to express complex logic instead. This closely resembles the [Actor model](https://en.wikipedia.org/wiki/Actor_model), where each machine instance is considered an "actor" that can send and receive events (messages) to and from other "actors" (such as Promises or machines) and react to them.

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
        // The onDone transition will be taken when the
        // minuteMachine has reached its top-level final state.
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
  - a function that returns a `Promise`
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
        id: 'getUser',
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
    success: {},
    failure: {
      on: {
        RETRY: 'loading'
      }
    }
  }
});
```

The resolved data is placed into a `'done.invoke.<id>'` event, under the `data` property, e.g.:

```js
{
  type: 'done.invoke.getUser',
  data: {
    name: 'David',
    location: 'Florida'
  }
}
```

## Configuring Services

The invocation sources (services) can be configured similar to how actions, guards, etc. are configured -- by specifying the `src` as a string and defining them in the `services` property of the Machine options:

```js
const fetchUser = // (same as the above example)

const userMachine = Machine({
  id: 'user',
  // ...
  states: {
    // ...
    loading: {
      invoke: {
        src: 'getUser',
        // ...
      }
    },
    // ...
  }
}, {
  services: {
    getUser: (ctx, event) => fetchUser(user.id)
  }
});
```

## Testing

By specifying services as strings above, "mocking" services can be done by specifying an alternative implementation with `.withConfig()`:

```js
import { interpret } from 'xstate/lib/interpreter';
import { assert } from 'chai';
import { userMachine } from '../path/to/userMachine';

const mockFetchUser = async userId => {
  // Mock however you want, but ensure that the same
  // behavior and response format is used
  return { name: 'Test', location: 'Anywhere' };
};

const testUserMachine = userMachine.withConfig({
  services: {
    getUser: (ctx, event) => mockFetchUser(ctx.id)
  }
});

describe('userMachine', () => {
  it('should go to the "success" state when a user is found', done => {
    interpret(testUserMachine)
      .onTransition(state => {
        if (state.matches('success')) {
          assert.deepEqual(state.context.user, {
            name: 'Test',
            location: 'Anywhere'
          });

          done();
        }
      })
      .start();
  });
});
```

## SCXML

The `invoke` property is synonymous to the SCXML `<invoke>` element:

```js
// XState
{
  loading: {
    invoke: {
      src: 'someSource',
      id: 'someID',
      forward: true,
      onDone: 'success',
      onError: 'failure'
    }
  }
}
```

```xml
<!-- SCXML -->
<state id="loading">
  <invoke id="someID" src="someSource" autoforward />
  <transition event="done.invoke.someID" target="success" />
  <transition event="error.execution" cond="_event.src === 'someID'" target="failure" />
</state>
```

- [https://www.w3.org/TR/scxml/#invoke](https://www.w3.org/TR/scxml/#invoke) - the definition of `<invoke>`
