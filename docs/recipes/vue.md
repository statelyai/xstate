# Usage with Vue

Usage of XState in a Vue application may vary depending on which version of Vue your application is running. This page focuses on Vue 2 only. To see how to use XState with Vue 3 check the documentation for the XState [`@xstate/vue` package](../packages/xstate-vue).

There are two ways you can use XState with Vue 2:

1. _Since Vue `^2.7`_: using the `useMachine` hook provided by the [`xstate-vue2` package](https://github.com/ChrisShank/xstate-vue2) (3rd-party) plugin;
2. Using XState `interpret` utility to create a service and inject it into your app.

::: tip
If you want to use the Vue Composition API, we recommend using the following packages:

- [`@xstate/vue` package](../packages/xstate-vue) for Vue 3
- [`xstate-vue2` package](https://github.com/ChrisShank/xstate-vue2) (3rd-party) for Vue `^2.7`

:::

Vue follows a similar pattern to [React](./react.md):

- The machine can be defined externally;
- The service is placed on the `data` object;
- State changes are observed via `service.onTransition(state => ...)`, where you set some data property to the next `state`;
- The machine's context can be referenced as an external data store by the app. Context changes are also observed via `service.onTransition(state => ...)`, where you set another data property to the updated context;
- The service is started (`service.start()`) when the component is `created()`;
- Events are sent to the service via `service.send(event)`.

The following recipes use the following `toggleMachine`:

```js
import { createMachine } from 'xstate';

// This machine is completely decoupled from Vue
export const toggleMachine = createMachine({
  id: 'toggle',
  context: {
    /* some data */
  },
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
```

## Using `useMachine` hook from `xstate-vue2` plugin

```html
<!-- toggle.vue -->
<!-- Top level bindigs are pre-processed via "setup" -->
<script setup>
  import { useMachine } from 'xstate-vue2';
  import toggleMachine from '../path/to/toggleMachine';

  const { state, send } = useMachine(toggleMachine);
</script>

<template>
  <main>
    <button @click="send('TOGGLE')">
      {{ state.value === "inactive" ? "Click to activate" : "Active! Click to
      deactivate" }}
    </button>
  </main>
</template>
```

## Using XState `interpret`

```html
<!-- Toggle.vue -->
<template>
  <button v-on:click="send('TOGGLE');">
    {{ current.matches("inactive") ? "Off" : "On" }}
  </button>
</template>

<script>
  import { interpret } from 'xstate';
  import { toggleMachine } from '../path/to/toggleMachine';

  export default {
    name: 'Toggle',
    created() {
      // Start service on component creation
      this.toggleService
        .onTransition((state) => {
          // Update the current state component data property with the next state
          this.current = state;
          // Update the context component data property with the updated context
          this.context = state.context;
        })
        .start();
    },
    data() {
      return {
        // Interpret the machine and store it in data
        toggleService: interpret(toggleMachine),

        // Start with the machine's initial state
        current: toggleMachine.initialState,

        // Start with the machine's initial context
        context: toggleMachine.context
      };
    },
    methods: {
      // Send events to the service
      send(event) {
        this.toggleService.send(event);
      }
    }
  };
</script>
```
