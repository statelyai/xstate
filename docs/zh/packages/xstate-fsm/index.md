# @xstate/fsm

<p align="center">
  <a href="https://xstate.js.org">
  <br />
  <img src="https://i.imgur.com/j4x2zzX.png" alt="XState FSM" width="200"/>
  <br />
    <sub><strong>XState for Finite State Machines</strong></sub>
  <br />
  <br />
  </a>
</p>

The [@xstate/fsm package](https://github.com/statelyai/xstate/tree/main/packages/xstate-fsm) contains a minimal, 1kb implementation of [XState](https://github.com/statelyai/xstate) for **finite state machines**.

## Features

|                             | **@xstate/fsm** | [XState](https://github.com/statelyai/xstate) |
| --------------------------- | :-------------: | :-------------------------------------------: |
| Finite states               |       ✅        |                      ✅                       |
| Initial state               |       ✅        |                      ✅                       |
| Transitions (object)        |       ✅        |                      ✅                       |
| Transitions (string target) |       ✅        |                      ✅                       |
| Delayed transitions         |       ❌        |                      ✅                       |
| Eventless transitions       |       ❌        |                      ✅                       |
| Nested states               |       ❌        |                      ✅                       |
| Parallel states             |       ❌        |                      ✅                       |
| History states              |       ❌        |                      ✅                       |
| Final states                |       ❌        |                      ✅                       |
| Context                     |       ✅        |                      ✅                       |
| Entry actions               |       ✅        |                      ✅                       |
| Exit actions                |       ✅        |                      ✅                       |
| Transition actions          |       ✅        |                      ✅                       |
| Parameterized actions       |       ❌        |                      ✅                       |
| Transition guards           |       ✅        |                      ✅                       |
| Parameterized guards        |       ❌        |                      ✅                       |
| Spawned actors              |       ❌        |                      ✅                       |
| Invoked actors              |       ❌        |                      ✅                       |

- Finite states (non-nested)
- Initial state
- Transitions (object or strings)
- Context
- Entry actions
- Exit actions
- Transition actions
- `state.changed`

If you want to use statechart features such as nested states, parallel states, history states, activities, invoked services, delayed transitions, transient transitions, etc. please use [`XState`](https://github.com/statelyai/xstate).

## Super quick start

**Installation**

```bash
npm i @xstate/fsm
```

**Usage (machine):**

```js
import { createMachine } from '@xstate/fsm';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});

const { initialState } = toggleMachine;

const toggledState = toggleMachine.transition(initialState, 'TOGGLE');
toggledState.value;
const untoggledState = toggleMachine.transition(toggledState, 'TOGGLE');
untoggledState.value;
// => 'inactive'
```

**Usage (service):**

```js
import { createMachine, interpret } from '@xstate/fsm';

const toggleMachine = createMachine({});

const toggleService = interpret(toggleMachine).start();

toggleService.subscribe((state) => {
  console.log(state.value);
});

toggleService.send('TOGGLE');
toggleService.send('TOGGLE');
toggleService.stop();
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Super quick start](#super-quick-start)
- [API](#api)
  - [`createMachine(config)`](#createmachineconfig)
  - [Machine config](#machine-config)
  - [State config](#state-config)
  - [Transition config](#transition-config)
  - [Machine options](#machine-options)
  - [Action config](#action-config)
  - [`machine.initialState`](#machineinitialstate)
  - [`machine.transition(state, event)`](#machinetransitionstate-event)
  - [State](#state)
  - [`interpret(machine)`](#interpretmachine)
  - [`service.subscribe(stateListener)`](#servicesubscribestatelistener)
  - [`service.send(event)`](#servicesendevent)
  - [`service.start()`](#servicestart)
  - [`service.stop()`](#servicestop)
- [TypeScript](#typescript)
- [Example](#example)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## API

### `createMachine(config, options)`

Creates a new finite state machine from the config.

| Argument  | Type               | Description                                 |
| --------- | ------------------ | ------------------------------------------- |
| `config`  | object (see below) | The config object for creating the machine. |
| `options` | object (see below) | The optional options object.                |

**Returns:**

A `Machine`, which provides:

- `machine.initialState`: the machine's resolved initial state
- `machine.transition(state, event)`: a pure transition function that returns the next state given the current `state` and `event`

The machine config has this schema:

### Machine config

- `id` (string) - an identifier for the type of machine this is. Useful for debugging.
- `initial` (string) - the key of the initial state.
- `states` (object) - an object mapping state names (keys) to [states](#state-config)

### State config

- `on` (object) - an object mapping event types (keys) to [transitions](#transition-config)

### Transition config

String syntax:

- (string) - the state name to transition to.
  - Same as `{ target: stateName }`

Object syntax:

- `target?` (string) - the state name to transition to.
- `actions?` (Action | Action[]) - the [action(s)](#action-config) to execute when this transition is taken.
- `cond?` (Guard) - the condition (predicate function) to test. If it returns `true`, the transition will be taken.

### Machine options

- `actions?` (object) - a lookup object for your string actions.

### Action config

Function syntax:

- (function) - the action function to execute. Resolves to `{ type: actionFn.name, exec: actionFn }` and the function takes the following arguments:
  1. `context` (any) - the machine's current `context`.
  2. `event` (object) - the event that caused the action to be executed.

Object syntax:

- `type` (string) - the action type.
- `exec?` (function) - the action function to execute.

String syntax:

- (string) - the action type.
  - By default it resolves to `{ type: actionType, exec: undefined }`. It can resolve to resolved function or resolved object action **if** the action can be looked up in the `options.actions` object.

<details>
  <summary>Why use a string or object for defining actions?</summary>

Using the string or object syntax is useful for handling actions in a custom way, rather than baking in the implementation details to your machine:

```js
const nextState = machine.transition();

nextState.actions.forEach((action) => {
  if (action.type === 'focus') {
  }
});
```

</details>

### `machine.initialState`

The resolved initial state of the `machine`.

### `machine.transition(state, event)`

A pure transition function that returns the next state given the current `state` and `event`.

The state can be a `string` state name, or a `State` object (the return type of `machine.transition(...)`).

| Argument | Type                                | Description                                                      |
| -------- | ----------------------------------- | ---------------------------------------------------------------- |
| `state`  | `string` or `State` object          | The current state to transition from                             |
| `event`  | `string` or `{ type: string, ... }` | The event that transitions the current `state` to the next state |

**Returns:**

A `State` object, which represents the next state.

**Example:**

```js
const yellowState = machine.transition('green', 'TIMER');
const redState = machine.transition(yellowState, 'TIMER');
const greenState = machine.transition(yellowState, { type: 'TIMER' });
// => { value: 'green', ... }
```

### State

An object that represents the state of a machine with the following schema:

- `value` (string) - the finite state value
- `context` (object) - the extended state (context)
- `actions` (array) - an array of action objects representing the side-effects (actions) to be executed
- `changed` (boolean) - whether this state is changed from the previous state (`true` if the `state.value` and `state.context` are the same, and there are no side-effects)
- `matches(value)` (boolean) - whether this state's value matches (i.e., is equal to) the `value`. This is useful for typestate checking.

### `interpret(machine)`

Creates an instance of an interpreted machine, also known as a **service**. This is a stateful representation of the running machine, which you can subscribe to, send events to, start, and stop.

Actions will also be executed by the interpreter.

| Argument  | Type         | Description                    |
| --------- | ------------ | ------------------------------ |
| `machine` | StateMachine | The machine to be interpreted. |

**Example:**

```js
import { createMachine, interpret } from '@xstate/fsm';

const machine = createMachine({});

const service = interpret(machine);

const subscription = service.subscribe((state) => {
  console.log(state);
});

service.start();

service.send('SOME_EVENT');
service.send({ type: 'ANOTHER_EVENT' });

subscription.unsubscribe();

service.stop();
```

### `service.subscribe(stateListener)`

A service (created from `interpret(machine)`) can be subscribed to via the `.subscribe(...)` method. The subscription will be notified of all state changes (including the initial state) and can be unsubscribed.

| Argument        | Type              | Description                                                                                     |
| --------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `stateListener` | `(state) => void` | The listener that is called with the interpreted machine's current `state` whenever it changes. |

**Returns:**

A subscription object with an `unsubscribe` method.

### `service.send(event)`

Sends an `event` to the interpreted machine. The event can be a string (e.g., `"EVENT"`) or an object with a `type` property (e.g., `{ type: "EVENT" }`).

| Argument | Type                                | Description                                      |
| -------- | ----------------------------------- | ------------------------------------------------ |
| `event`  | `string` or `{ type: string, ... }` | The event to be sent to the interpreted machine. |

### `service.start()`

Starts the interpreted machine.

Events sent to the interpreted machine will not trigger any transitions until the service is started. All listeners (via `service.subscribe(listener)`) will receive the `machine.initialState`.

### `service.stop()`

Stops the interpreted machine.

Events sent to a stopped service will no longer trigger any transitions. All listeners (via `service.subscribe(listener)`) will be unsubscribed.

## TypeScript

A machine can be strictly typed by passing in 3 generic types:

- `TContext` - the machine's `context`
- `TEvent` - all events that the machine accepts
- `TState` - all states that the machine can be in

The `TContext` type should be an `object` that represents all possible combined types of `state.context`.

The `TEvent` type should be the union of all event objects that the machine can accept, where each event object has a `{ type: string }` property, as well as any other properties that may be present.

The `TState` type should be the union of all typestates (value and contexts) that the machine can be in, where each typestate has:

- `value` (string) - the value (name) of the state
- `context` (object) - an object that extends `TContext` and narrows the shape of the context to what it should be in this state.

**Example:**

```ts
interface User {
  name: string;
}

interface UserContext {
  user?: User;
  error?: string;
}

type UserEvent =
  | { type: 'FETCH'; id: string }
  | { type: 'RESOLVE'; user: User }
  | { type: 'REJECT'; error: string };

type UserState =
  | {
      value: 'idle';
      context: UserContext & {
        user: undefined;
        error: undefined;
      };
    }
  | {
      value: 'loading';
      context: UserContext;
    }
  | {
      value: 'success';
      context: UserContext & { user: User; error: undefined };
    }
  | {
      value: 'failure';
      context: UserContext & { user: undefined; error: string };
    };

const userMachine = createMachine<UserContext, UserEvent, UserState>({
  /* ... */
});

const userService = interpret(userMachine);

userService.subscribe((state) => {
  if (state.matches('success')) {
    // from UserState, `user` will be defined
    state.context.user.name;
  }
});
```

## Example

```js
import { createMachine, assign, interpret } from '@xstate/fsm';

const lightMachine = createMachine({
  id: 'light',
  initial: 'green',
  context: { redLights: 0 },
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: {
          target: 'red',
          actions: () => console.log('Going to red!')
        }
      }
    },
    red: {
      entry: assign({ redLights: (ctx) => ctx.redLights + 1 }),
      on: {
        TIMER: 'green'
      }
    }
  }
});

const lightService = interpret(lightMachine);

lightService.subscribe((state) => {
  console.log(state);
});

lightService.start();
lightService.send('TIMER');
lightService.send('TIMER');
// => logs {
//   value: 'red',
//   context: { redLights: 1 },
//   actions: [],
//   changed: true
// }
```
