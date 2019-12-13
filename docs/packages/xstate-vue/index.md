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
    {{current.value === 'inactive'
      ? 'Click to activate'
      : 'Active! Click to deactivate'}}
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
    const {current, send} = useMachine(toggleMachine);
    return {
      current,
      send
    }
  }
};
```

## API

### `useMachine(machine, options?)`

A [Vue comosition function](https://vue-composition-api-rfc.netlify.com/) that interprets the given `machine` and starts a service that runs for the lifetime of the component.

**Arguments**

- `machine` - An [XState machine](https://xstate.js.org/docs/guides/machines.html).
- `options` (optional) - [Interpreter options](https://xstate.js.org/docs/guides/interpretation.html#options) OR one of the following Machine Config options: `guards`, `actions`, `activities`, `services`, `delays`, `immediate`, `context`, or `state`.

**Returns** `{ current, send, service}`:

- `current` - Represents the current state of the machine as an XState `State` object.
- `send` - A function that sends events to the running service.
- `service` - The created service.

### `useService(service)` (TODO)

### `useActor(actor)` (TODO)
