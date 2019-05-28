# Actors

<Badge text="4.6+"/>

The [Actor model](https://en.wikipedia.org/wiki/Actor_model) is a mathematical model of message-based computation that simplifies how multiple "entities" (or "actors") communicate with each other. Actors communicate by sending messages (events) to each other. An actor's local state is private, unless it wishes to share it with another actor, by sending it as an event.

When an actor receives an event, three things can happen:

- A finite number of messages can be **sent** to other actors
- A finite number of new actors can be created (or **spawned**)
- The actor's local state may change (determined by its **behavior**)

State machines and statecharts work very well with the actor model, as they are event-based models of behavior and logic. Remember: when a state machine transitions due to an event, the next state contains:

- The next `value` and `context` (an actor's local state)
- The next `actions` to be executed (potentially newly spawned actors or messages sent to other actors)

Actors can be considered a dynamic variant of [invoked services](./communication.md) (same internal implementation!) with two important differences:

- They can be _spawned_ at any time (as an action)
- They can be _stopped_ at any time (as an action)

## Actor API

An actor (as implemented in XState) has an interface of:

- An `id` property, which uniquely identifies the actor in the local system
- A `.send(...)` method, which is used to send events to this actor

They may have optional methods:

- A `.stop()` method which stops the actor and performs any necessary cleanup
- A `.subscribe(...)` method for actors that implement an [Observable](TODO: link) interface.

All the existing invoked service patterns fit this interface:

- [Invoked promises](./communication.md#invoking-promises) are actors that ignore any received events and send at most one event back to the parent
- [Invoked callbacks](./communication.md#invoking-callbacks) are actors that can send events to the parent (first `callback` argument), receive events (second `onReceive` argument), and act on them
- [Invoked machines](./communication.md#invoking-machines) are actors that can send events to the parent (`sendParent(...)` action) or other actors it has references to (`send(...)` action), receive events, act on them (state transitions and actions), spawn new actors (`spawn(...)` function), and stop actors.

## Spawning actors

Just as in Actor-model-based languages like [Akka](TODO: link) or [Erlang](TODO: link), actors are spawned and referenced in `context` (as the result of an `assign(...)` action).

1. Import the `spawn` function from `'xstate'`
2. In an `assign(...)` action, create a new actor reference with `spawn(...)`

The `spawn(...)` function creates an **actor reference**.

```js {13}
import { Machine, spawn } from 'xstate';
import { todoMachine } from './todoMachine';

const todosMachine = Machine({
  // ...
  on: {
    'NEW_TODO.ADD': {
      actions: assign({
        todos: (context, event) => [
          ...context.todos,
          {
            todo: event.todo,
            ref: spawn(todoMachine) // add a new todoMachine actor
          }
        ]
      })
    }
    // ...
  }
});
```

::: tip
Treat `const actorRef = spawn(someMachine)` as just a normal value in `context`. You can place this `actorRef` anywhere within `context`, based on your logic requirements. As long as it's within an assignment function in `assign(...)`, it will be scoped to the service from where it was spawned.
:::

::: warning
Do not call `spawn(...)` outside of an assignment function. This will produce an orphaned actor (without a parent) which will have no effect.

```js
// ❌ Never call spawn(...) externally
const someActorRef = spawn(someMachine);

// ❌ spawn(...) is not an action creator
{
  actions: spawn(someMachine);
}

// ❌ Do not assign spawn(...) outside of an assignment function
{
  actions: assign({
    // remember: this is called immediately, before a service starts
    someActorRef: spawn(someMachine)
  });
}

// ✅ Assign spawn(...) inside an assignment function
{
  actions: assign({
    someActorRef: () => spawn(someMachine)
  });
}
```

:::

Different types of values can be spawned as actors.

## Sending events to actors

With the [`send()` action](./actions.md#send-action), events can be sent to actors via a [target expression](./actions.md#send-targets):

```js
const machine = Machine({
  // ...
  states: {
    active: {
      entry: assign({
        someRef: () => spawn(someMachine)
      }),
      on: {
        SOME_EVENT: {
          // Use a target expression to send an event
          // to the actor reference
          actions: send('PING', {
            to: context => context.someRef
          })
        }
      }
    }
  }
});
```

## Spawning Promises

Just like [invoking promises](./communication.md#invoking-promises), promises can be spawned as actors:

```js
// Returns a promise
const fetchData = query => {
  return fetch(`http://example.com?query=${event.query}`).then(data =>
    data.json()
  );
};

// ...
{
  actions: assign({
    ref: (_, event) => spawn(fetchData(event.query))
  });
}
// ...
```

## Spawning callbacks

Just like [invoking callbacks](./communication.md#invoking-callbacks), callbacks can be spawned as actors. This example models a counter-interval actor that increments its own count every second, but can also react to `{ type: 'INC' }` events.

```js
const counterInterval = (callback, receive) => {
  let count = 0;

  const intervalId = setInterval(() => {
    callback({ type: 'COUNT.UPDATE', count });
    count++;
  }, 1000);

  receive(event => {
    if (event.type === 'INC') {
      count++;
    }
  });

  return () => { clearInterval(intervalId); }
}

const machine = Machine({
  // ...
  {
    actions: assign({
      counterRef: () => spawn(counterInterval)
    })
  }
  // ...
});
```

Events can then be sent to the actor:

```js
const machine = Machine({
  // ...
  on: {
    'COUNTER.INC': {
      actions: send('INC', {
        to: context => context.ref
      })
    }
  }
  // ...
});
```

## Spawning machines

Machines are the most effective way to use actors, since they offer the most capabilities. Spawning machines is just like [invoking machines](./communication.md#invoking-machines), where a `machine` is passed into `spawn(machine)`:

```js
const remoteMachine = Machine({
  id: 'remote',
  initial: 'offline',
  states: {
    offline: {
      on: {
        WAKE: 'online'
      }
    },
    online: {
      after {
        1000: {
          actions: sendParent('REMOTE.ONLINE')
        }
      }
    }
  }
});

const parentMachine = Machine({
  id: 'parent',
  initial: 'waiting',
  states: {
    waiting: {
      entry: assign({
        localOne: () => spawn(remoteMachine)
      }),
      on: {
        'LOCAL.WAKE': {
          actions: send('WAKE', {
            to: context => context.localOne
          })
        },
        'REMOTE.ONLINE': 'connected'
      }
    },
    connected: {}
  }
});

const parentService = interpret(parentMachine)
  .onTransition(state => console.log(state.value))
  .start();

parentService.send('LOCAL.WAKE');
// => 'waiting'
// ... after 1000ms
// => 'connected'
```
