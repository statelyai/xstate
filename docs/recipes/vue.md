# Usage with Vue

::: tip
If you want to use the Vue Composition API, we recommend using the following packages:

- [`@xstate/vue` package](../packages/xstate-vue) for Vue 3
- [`xstate-vue2` package](https://github.com/ChrisShank/xstate-vue2) (3rd-party) for Vue 2

:::

Vue follows a similar pattern to [React](./react.md):

- The machine can be defined externally;
- The service is placed on the `data` object;
- State changes are observed via `service.onTransition(state => ...)`, where you set some data property to the next `state`;
- The machine's context can be referenced as an external data store by the app. Context changes are also observed via `service.onTransition(state => ...)`, where you set another data property to the updated context;
- The service is started (`service.start()`) when the component is `created()`;
- Events are sent to the service via `service.send(event)`.

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
