# Invoking Services

Expressing the entire app's behavior in a single machine can quickly become complex and unwieldy. It is natural (and encouraged!) to use multiple machines that communicate with each other to express complex logic instead. This closely resembles the [Actor model](https://www.brianstorti.com/the-actor-model/), where each machine instance is considered an "actor" that can send and receive events (messages) to and from other "actors" (such as Promises or other machines) and react to them.

For machines to communicate with each other, the parent machine **invokes** a child machine and listens to events sent from the child machine via `sendParent(...)`, or waits for the child machine to reach its [final state](./final.md), which will then cause the `onDone` transition to be taken.

You can invoke:

- [Promises](#invoking-promises), which will take the `onDone` transition on `resolve`, or the `onError` transition on `reject`
- [Callbacks](#invoking-callbacks), which can send events to and receive events from the parent machine
- [Machines](#invoking-machines), which can also send/receive events, and also notify the parent machine when it reaches its [final state](./final.md)

## The `invoke` Property

An invocation is defined in a state node's configuration with the `invoke` property, whose value is an object that contains:

- `src` - the source of the machine to invoke, which can be:
  - a machine
  - a string, which refers to a machine defined in this machine's `options.services`
  - a function that returns a `Promise`
  - a function that returns a callback handler, which sends events to the parent via the callback (example below)
- `id` - the unique identifier for the invoked service
- `forward` - (optional) `true` if all events sent to this machine should also be sent (or _forwarded_) to the invoked child machine (`false` by default)
- `data` - (optional) an object that maps properties of the child machine's [context](./context.md) to a function that returns the corresponding value from the parent machine's `context`.
- `onDone` - (optional) the [transition](./transitions.md) to be taken when the child machine reaches its [final state](./final.md)
- `onError` - (optional) the transition to be taken when the child machine encounters an execution error.

## Invoking Promises

Since every promise can be modeled as a state machine, XState can invoke promises as-is. Promises can either:

- `resolve()`, which will take the `onDone` transition
- `reject()` (or throw an error), which will take the `onError` transition

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
          actions: assign({ error: (ctx, event) => event.data })
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

### Promise Rejection

If a Promise rejects, the `onError` transition will be taken with a `{ type: 'error.execution' }` event. The error data is available on the event's `data` property:

```js
const search = (ctx, event) => new Promise((resolve, reject) => {
  if (!event.query.length) {
    return reject('No query specified');
    // or:
    // throw new Error('No query specified');
  }

  return getSearchResults(event.query);
});

// ...
const searchMachine = Machine({
  id: 'search',
  initial: 'idle',
  context: {
    results: undefined,
    errorMessage: undefined,
  },
  states: {
    idle: {
      on: { SEARCH: 'searching' }
    },
    searching: {
      invoke: {
        id: 'search'
        src: search,
        onError: {
          target: 'failure',
          actions: assign({
            errorMessage: (ctx, event) => {
              // event is:
              // { type: 'error.execution', data: 'No query specified' }
              return event.data.message;
            }
          })
        },
        onDone: {
          target: 'success',
          actions: assign({ results: (_, event) => event.data })
        }
      }
    },
    success: {},
    failure: {}
  }
});
```

## Invoking Callbacks

(since 4.2) Streams of events sent to the parent machine can be modeled via a callback handler, which is a function that takes in two arguments:

- `callback` - called with the event to be sent
- `onEvent` - called with a listener that [listens to events from the parent](#listening-to-parent-events)

The (optional) return value should be a function that performs cleanup (i.e., unsubscribing, preventing memory leaks, etc.) on the invoked service when the current state is exited.

```js
// ...
counting: {
  invoke: {
    id: 'incInterval',
    src: (ctx, event) => (callback, onEvent) => {
      // This will send the 'INC' event to the parent every second
      const id = setInterval(() => callback('INC'), 1000);

      // Perform cleanup
      return () => clearInterval(id);
    }
  },
  on: {
    INC: { actions: assign({ counter: ctx => ctx.counter + 1 }) }
  }
}
// ...
```

### Listening to Parent Events

Invoked callback handlers are also given a second argument, `onEvent`, which registers listeners for events sent to the callback handler from the parent. This allows for parent-child communication between the parent machine and the invoked callback service.

For example, the parent machine sends the child `'ponger'` service a `'PING'` event. The child service can listen for that event using `onEvent(listener)`, and send a `'PONG'` event back to the parent in response:

```js
const pingPongMachine = Machine({
  id: 'pinger',
  initial: 'active',
  states: {
    active: {
      invoke: {
        id: 'ponger',
        src: (ctx, event) => (callback, onEvent) => {
          // Whenever parent sends 'PING',
          // send parent 'PONG' event
          onEvent(e => {
            if (e.type === 'PING') {
              callback('PONG');
            }
          });
        }
      },
      onEntry: send('PING', { to: 'ponger' }),
      on: {
        PONG: 'done'
      }
    },
    done: {
      type: 'final'
    }
  }
});

interpret(pingPongMachine)
  .onDone(() => done())
  .start();
```

## Invoking Machines

Machines communicate hierarchically, and invoked machines can communicate:

- Parent-to-child via the `send(EVENT, { to: 'someChildId' })` action
- Child-to-parent via the `sendParent(EVENT)` action.

```js
import { Machine, interpret, send, sendParent } from 'xstate';

// Invoked child machine
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

### Invoking with Context

Child machines can be invoked with `context` that is derived from the parent machine's `context` with the `data` property. For example, the `parentMachine` below will invoke a new `timerMachine` service with initial context of `{ customDuration: 3000 }`:

```js
const timerMachine = Machine({
  id: 'timer',
  context: {
    duration: 1000 // default duration
  }
  /* ... */
});

const parentMachine = Machine({
  id: 'parent',
  initial: 'active',
  context: {
    customDuration: 3000
  },
  states: {
    active: {
      invoke: {
        id: 'timer',
        src: timerMachine,
        // Deriving child context from parent context
        data: {
          duration: (ctx, event) => ctx.customDuration
        }
      }
    }
  }
});
```

Just like [`assign(...)`](./context.md), child context can be mapped as an object (preferred) or a function:

```js
// Object (per-property):
data: {
  duration: (ctx, event) => ctx.customDuration,
  foo: (ctx, event) => event.value,
  bar: 'static value'
}

// Function (aggregate), equivalent to above:
data: (ctx, event) => ({
  duration: ctx.customDuration,
  foo: event.value,
  bar: 'static value'
})
```

### Done Data

When a child machine reaches its top-level [final state](./final.md), it can send data in the "done" event (e.g., `{ type: 'done.invoke.someId', data: ... })`). This "done data" is specified on the final state's `data` property:

```js
const secretMachine = Machine({
  id: 'secret',
  initial: 'wait',
  context: {
    secret: '42'
  },
  states: {
    wait: {
      after: {
        1000: 'reveal'
      }
    },
    reveal: {
      type: 'final',
      data: {
        secret: (ctx, event) => ctx.secret
      }
    }
  }
});

const parentMachine = Machine({
  id: 'parent',
  initial: 'pending',
  context: {
    revealedSecret: undefined
  },
  states: {
    pending: {
      invoke: {
        id: 'secret',
        src: secretMachine,
        onDone: {
          target: 'success',
          actions: assign({
            revealedSecret: (ctx, event) => {
              // event is:
              // { type: 'done.invoke.secret', data: { secret: '42' } }
              return event.data.secret;
            }
          })
        }
      }
    },
    success: {}
  }
});

const service = interpret(parentMachine)
  .onTransition(state => console.log(state.context))
  .start();
// => { revealedSecret: undefined }
// ...
// => { revealedSecret: '42' }
```

### Sending Events

- To send from a **child** machine to a **parent** machine, use `sendParent(event)` (takes the same arguments as `send(...)`)
- To send from a **parent** machine to a **child** machine, use `send(event, { to: <child ID> })`

::: warning
The `send(...)` and `sendParent(...)` action creators do _not_ imperatively send events to machines. They are pure functions that return an action object describing what is to be sent, e.g., `{ type: 'xstate.send', event: ... }`. An [interpreter](./interpretation.md) will read these objects and then send them.
:::

Here is an example of two machines, `pingMachine` and `pongMachine`, communicating with each other:

```js
import { Machine, interpret, send, sendParent } from 'xstate';

// Parent machine
const pingMachine = Machine({
  id: 'ping',
  initial: 'active',
  states: {
    active: {
      invoke: {
        id: 'pong',
        src: pongMachine
      }
      // Sends 'PING' event to child machine with ID 'pong'
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

// Invoked child machine
const pongMachine = Machine({
  id: 'pong',
  initial: 'active',
  states: {
    active: {
      on: {
        PING: {
          // Sends 'PONG' event to parent machine
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

## Multiple Services

You can invoke multiple services by specifying each in an array:

```js
// ...
invoke: [
  { id: 'service1', src: 'someService' },
  { id: 'service2', src: 'someService' },
  { id: 'logService', src: 'logService' }
],
// ...
```

Each invocation will create a _new_ instance of that service, so even if the `src` of multiple services are the same (e.g., `'someService'` above), multiple instances of `'someService'` will be invoked.

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
import { interpret } from 'xstate';
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
