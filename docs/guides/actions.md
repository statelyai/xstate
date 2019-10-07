# Actions

Actions are fire-and-forget ["side effects"](./effects.md). For a machine to be useful in a real-world application, side effects need to occur to make things happen in the real world, such as rendering to a screen.

Actions are _not_ immediately triggered. Instead, [the `State` object](./states.md) returned from `machine.transition(...)` will declaratively provide an array of `.actions` that an interpreter can then execute.

There are three types of actions:

- `entry` actions are executed upon entering a state
- `exit` actions are executed upon exiting a state
- transition actions are executed when a transition is taken.

These are represented in the StateNode definition:

```js {10-11,16-19,27-41}
const triggerMachine = Machine(
  {
    id: 'trigger',
    initial: 'inactive',
    states: {
      inactive: {
        on: {
          TRIGGER: {
            target: 'active',
            // transition actions
            actions: ['activate', 'sendTelemetry']
          }
        }
      },
      active: {
        // entry actions
        entry: ['notifyActive', 'sendTelemetry'],
        // exit actions
        exit: ['notifyInactive', 'sendTelemetry'],
        on: {
          STOP: 'inactive'
        }
      }
    }
  },
  {
    actions: {
      // action implementations
      activate: (context, event) => {
        console.log('activating...');
      },
      notifyActive: (context, event) => {
        console.log('active!');
      },
      notifyInactive: (context, event) => {
        console.log('inactive!');
      },
      sendTelemetry: (context, event) => {
        console.log('time:', Date.now());
      }
    }
  }
);
```

::: tip
Action implementations can be quickly prototyped by specifying the action function directly in the machine config:

```js {4}
// ...
TRIGGER: {
  target: 'active',
  actions: (context, event) => { console.log('activating...'); }
}
// ...
```

It is _not recommended_ to keep the machine config like this in production code, as this makes it difficult to debug, serialize, test, and accurately visualize actions. Always prefer refactoring inline action implementations in the `actions` property of the machine options, like the previous example.
:::

## Declarative Actions

The `State` instance returned from `machine.transition(...)` has an `.actions` property, which is an array of action objects for the interpreter to execute:

```js {4-9}
const activeState = triggerMachine.transition('inactive', 'TRIGGER');

console.log(activeState.actions);
// [
//   { type: 'activate', exec: ... },
//   { type: 'sendTelemetry', exec: ... },
//   { type: 'notifyActive', exec: ... },
//   { type: 'sendTelemetry', exec: ... }
// ]
```

Each action object has two properties (and others, that you can specify):

- `type` - the action type
- `exec` - the action implementation function

The `exec` function takes three arguments:

- `context` - the current machine context
- `event` - the event that caused the transition
- `actionMeta` <Badge text="4.4+"/> - an object containing meta data about the action, including:
  - `action` - the original action object
  - `state` - the resolved machine state, after transition

The interpreter will call the `exec` function with the `currentState.context`, the `event`, and the `state` that the machine transitioned to. This behavior can be customized. See [executing actions](./interpretation.md#executing-actions) for more details.

## Action order

When interpreting statecharts, the order of actions should not necessarily matter (that is, they should not be dependent on each other). However, the order of the actions in the `state.actions` array is:

1. `exit` actions - all the exit actions of the exited state node(s), from the atomic state node up
2. transition `actions` - all actions defined on the chosen transition
3. `entry` actions - all the entry actions of the entered state node(s), from the parent state down

## Send Action

The `send(event)` action creator creates a special "send" action object that tells a service (i.e., [interpreted machine](./interpretation.md)) to send that event to itself. It queues an event to the running service, in the external event queue. This means the event is sent on the next "step" of the interpreter.

::: warning
The `send(...)` function is an **action creator**; it is a pure function that only returns an action object and does _not_ imperatively send an event.
:::

```js
import { Machine, send } from 'xstate';

const lazyStubbornMachine = Machine({
  id: 'stubborn',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // send the TOGGLE event again to the service
          actions: send('TOGGLE')
        }
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});

const nextState = lazyStubbornMachine.transition('inactive', 'TOGGLE');

nextState.value;
// => 'active'
nextState.actions;
// => [{ type: 'xstate.send', event: { type: 'TOGGLE' }}]

// The service will proceed to send itself the { type: 'TOGGLE' } event.
```

The `event` argument passed to `send(event)` can be:

- A string event, e.g., `send('TOGGLE')`
- An event object, e.g., `send({ type: 'TOGGLE', payload: ... })`
- An event expression, which is a function that takes in the current `context` and `event` that triggered the `send()` action, and returns an event object:

```js
import { send } from 'xstate';

// contrived example - reads from the `context` and sends
// the dynamically created event
const sendName = send((context, event) => ({
  type: 'NAME',
  name: context.user.name
}));

const machine = Machine({
  // ...
  on: {
    TOGGLE: {
      actions: sendName
    }
  }
  //...
});
```

### Send Targets

An event sent from a `send(...)` action can be sent to specific targets, such as [invoked services](./communication.md) or [spawned actors](./actors.md). This is done by specifying the `{ to: ... }` property in the `send(...)` action:

```js
// ...
invoke: {
  id: 'some-service-id',
  src: 'someService',
  // ...
},
// ...
// Send { type: 'SOME_EVENT' } to the invoked service
actions: send('SOME_EVENT', { to: 'some-service-id' })
```

The target in the `to` prop can also be a **target expression**, which is a function that takes in the current `context` and `event` that triggered the action, and returns either a string target or an [actor reference](./actors.md#spawning-actors):

```js
entry: assign({
  someActor: () => {
    const name = 'some-actor-name';

    return {
      name,
      ref: spawn(someMachine, name);
    }
  }
}),
// ...

// Send { type: 'SOME_EVENT' } to the actor ref via string target
{
  actions: send('SOME_EVENT', {
    to: context => context.someActor.name
  })
}
// ...

// Send { type: 'SOME_EVENT' } to the actor ref via ref target
{
  actions: send('SOME_EVENT', {
    to: context => context.someActor.ref
  })
}
```

## Raise Action

The `raise()` action creator queues an event to the statechart, in the internal event queue. This means the event is immediately sent on the current "step" of the interpreter.

```js
import { Machine, actions } from 'xstate';
const { raise } = actions;

const stubbornMachine = Machine({
  id: 'stubborn',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // immediately consume the TOGGLE event
          actions: raise('TOGGLE')
        }
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});

const nextState = stubbornMachine.transition('inactive', 'TOGGLE');

nextState.value;
// => 'inactive'
nextState.actions;
// => []
```

## Respond Action <Badge text="4.7+" />

The `respond()` action creator creates a [`send()` action](#send-action) that is sent to the service that sent the event which triggered the response.

This uses [SCXML events](./events.md#scxml-events) internally to get the `origin` from the event and set the `target` of the `send()` action to the `origin`.

| Argument   | Type                                     | Description                             |
| ---------- | ---------------------------------------- | --------------------------------------- |
| `event`    | string, event object, or send expression | The event to send back to the sender    |
| `options?` | send options object                      | Options to pass into the `send()` event |

**Example:**

This demonstrates some parent service (`authClientMachine`) sending a `'CODE'` event to the invoked `authServerMachine`, and the `authServerMachine` responding with a `'TOKEN'` event.

```js
const authServerMachine = Machine({
  initial: 'waitingForCode',
  states: {
    waitingForCode: {
      on: {
        CODE: {
          actions: respond('TOKEN', { delay: 10 })
        }
      }
    }
  }
});

const authClientMachine = Machine({
  initial: 'idle',
  states: {
    idle: {
      on: { AUTH: 'authorizing' }
    },
    authorizing: {
      invoke: {
        id: 'auth-server',
        src: authServerMachine
      },
      entry: send('CODE', { to: 'auth-server' }),
      on: {
        TOKEN: 'authorized'
      }
    },
    authorized: {
      type: 'final'
    }
  }
});
```

See [📖 Sending Responses](./actors.md#sending-responses) for more details.

## Forward To Action <Badge text="4.7+">

The `forwardTo()` action creator creates a [`send()` action](#send-action) that forwards the most recent event to the specified service via its ID.

| Argument | Type                                    | Description                                          |
| -------- | --------------------------------------- | ---------------------------------------------------- |
| `target` | string or function that returns service | The target service to send the most recent event to. |

**Example:**

```js
import { Machine, forwardTo, interpret } from 'xstate';

function alertService(_, receive) {
  receive(event => {
    if (event.type === 'ALERT') {
      alert(event.message);
    }
  });
}

const parentMachine = Machine({
  id: 'parent',
  invoke: {
    id: 'alerter',
    src: () => alertService
  },
  on: {
    ALERT: { actions: forwardTo('alerter') }
  }
});

const parentService = interpret(parentMachine).start();

parentService.send('ALERT', { message: 'hello world' });
// => alerts "hello world"
```

## Log Action

The `log()` action creator is a declarative way of logging anything related to the current state `context` and/or `event`. It takes two optional arguments:

- `expr` (optional) - a function that takes the `context` and `event` as arguments and returns a value to be logged
- `label` (optional) - a string to label the logged message

```js {13-16,27-33}
import { Machine, actions } from 'xstate';
const { log } = actions;

const loggingMachine = Machine({
  id: 'logging',
  context: { count: 42 },
  initial: 'start',
  states: {
    start: {
      on: {
        FINISH: {
          target: 'end',
          actions: log(
            (context, event) => `count: ${context.count}, event: ${event.type}`,
            'Finish label'
          )
        }
      }
    },
    end: {}
  }
});

const endState = loggingMachine.transition('start', 'FINISH');

endState.actions;
// [
//   {
//     type: 'xstate.log',
//     label: 'Finish label',
//     expr: (context, event) => ...
//   }
// ]

// The interpreter would log the action's evaluated expression
// based on the current state context and event.
```

Without any arguments, `log()` is an action that logs an object with `context` and `event` properties, containing the current context and triggering event, respectively.

## Actions on self-transitions

A [self-transition](./transitions.md#self-transitions) is when a state transitions to itself, in which it _may_ exit and then reenter itself. Self-transitions can either be an **internal** or **external** transition:

- An internal transition will _not_ exit and reenter itself, so the state node's `entry` and `onExit` actions will not be executed again.
  - Internal transitions are indicated with `{ internal: true }`, or by leaving the `target` as `undefined`.
  - Actions defined on the transition's `actions` property will be executed.
- An external transition _will_ exit and reenter itself, so the state node's `entry` and `onExit` actions will be executed again.
  - All transitions are external by default. To be explicit, you can indicate them with `{ internal: false }`.
  - Actions defined on the transition's `actions` property will be executed.

For example, this counter machine has one `'counting'` state with internal and external transitions:

```js {9-12}
const counterMachine = Machine({
  id: 'counter',
  initial: 'counting',
  states: {
    counting: {
      entry: 'enterCounting',
      onExit: 'exitCounting',
      on: {
        // self-transitions
        INC: { actions: 'increment' }, // internal (implicit)
        DEC: { target: 'counting', actions: 'decrement' }, // external
        DO_NOTHING: { internal: true, actions: 'logNothing' } // internal (explicit)
      }
    }
  }
});

// External transition (onExit + transition actions + entry)
const stateA = counterMachine.transition('counting', 'DEC');
stateA.actions;
// ['exitCounting', 'decrement', 'enterCounting']

// Internal transition (transition actions)
const stateB = counterMachine.transition('counting', 'DO_NOTHING');
stateB.actions;
// ['logNothing']

const stateC = counterMachine.transition('counting', 'INC');
stateB.actions;
// ['increment']
```

## SCXML

Executable actions in transitions are equivalent to the `<script>` element. The `entry` and `exit` properties are equivalent to the `<onentry>` and `<onexit>` elements, respectively.

```js
{
  start: {
    entry: 'showStartScreen',
    exit: 'logScreenChange',
    on: {
      STOP: {
        target: 'stop',
        actions: ['logStop', 'stopEverything']
      }
    }
  }
}
```

```xml
<state id="start">
  <onentry>
    <script>showStartScreen();</script>
  </onentry>
  <onexit>
    <script>logScreenChange();</script>
  </onexit>
  <transition event="STOP" target="stop">
    <script>logStop();</script>
    <script>stopEverything();</script>
  </transition>
</state>
```

- [https://www.w3.org/TR/scxml/#script](https://www.w3.org/TR/scxml/#script) - the definition of the `<script>` element
- [https://www.w3.org/TR/scxml/#onentry](https://www.w3.org/TR/scxml/#onentry) - the definition of the `<onentry>` element
- [https://www.w3.org/TR/scxml/#onexit](https://www.w3.org/TR/scxml/#onexit) - the definition of the `<onexit>` element
