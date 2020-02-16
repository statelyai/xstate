# @xstate/vue

## Quick Start

1. Install `xstate` and `@xstate/vue`:

```bash
npm i xstate @xstate/vue
```

2. Import the `useMachine` composition function:

```vue
<template>
  <button @click="send('TOGGLE')">
    {{
      current.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'
    }}
  </button>
</template>

<script>
import { useMachine } from '@xstate/vue';
import { Machine } from 'xstate';

const toggleMachine = Machine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

export default {
  setup() {
    const { current, send } = useMachine(toggleMachine);
    return {
      current,
      send
    };
  }
};
</script>
```

## API

### `useMachine(machine, options?)`

A [Vue composition function](https://vue-composition-api-rfc.netlify.com/) that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html).
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) OR one of the following Machine Config options: `guards`, `actions`, `activities`, `services`, `delays`, `immediate`, `context`, or `state`.

**Returns** `{ current, send, service}`:

- `current` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useService(service)`

A [Vue composition function](https://vue-composition-api-rfc.netlify.com/) that subscribes to state changes from an existing [service](TODO).

**Arguments**

- `service` - An [XState service](https://xstate.js.org/docs/guides/communication.html).

**Returns** `{current, send}`:

- `current` - Represents the current state of the service as an XState `State` object.
- `send` - A function that sends events to the running service.

### `useMachine(machine)` with `@xstate/fsm`

A [Vue composition function](https://vue-composition-api-rfc.netlify.com/) that interprets the given finite state `machine` from [`@xstate/fsm`] and starts a service that runs for the lifetime of the component.

This special `useMachine` hook is imported from `@xstate/vue/lib/fsm`

**Arguments**

- `machine` - An [XState finite state machine (FSM)](https://xstate.js.org/docs/packages/xstate-fsm/).

**Returns** an object `{current, send, service}`:

- `current` - Represents the current state of the machine as an `@xstate/fsm` `StateMachine.State` object.
- `send` - A function that sends events to the running service.
- `service` - The created `@xstate/fsm` service.

**Example** (TODO)

## Configuring Machines (TODO)

Existing machines can be configured by passing the machine options as the 2nd argument of `useMachine(machine, options)`.

Example: the `'fetchData'` service and `'notifySuccess'` action are both configurable:

**Example** (TODO)

## Matching States

For [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it's better to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-getters):

```vue
<template>
  <div>
    <loader-idle v-if="current.matches('idle')" />
    <loader-loading-user v-if-else="current.matches({ loading: 'user' })" />
    <loader-loading-friends
      v-if-else="current.matches({ loading: 'friends' })"
    />
  </div>
</template>
```

## Persisted and Rehydrated State

You can persist and rehydrate state with `useMachine(...)` via `options.state`:

```vue
<script>
// Get the persisted state config object from somewhere, e.g. localStorage
const persistedState = JSON.parse(
  localStorage.getItem('some-persisted-state-key')
);

export default {
  setup() {
    const { current, send } = useMachine(someMachine, {
      state: persistedState
    });

    // current will initially be that persisted state, not the machine's initialState
    return { current, send };
  }
};
</script>
```
