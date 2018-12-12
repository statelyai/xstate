## Usage with Vue

Vue follows a similar pattern to [React](./react.md):

- The machine can be defined externally
- The service is placed on the `data` object
- State changes are observed via `service.onTransition(state => ...)`, where you set some data property to the next `state`
- The service is started (`service.start()`) when the component is `created()`
- Events are sent to the service via `service.send(event)`.

```html
<!-- Toggle.vue -->
<template>
  <div class="toggle">
    <h1>{{ value }}</h1>
    <button v-on:click="send('TOGGLE');">Toggle</button>
  </div>
</template>

<script>
  import { Machine } from 'xstate';
  import { interpret } from 'xstate/lib/interpreter';

  // Define machine externally
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
    name: 'Toggle',
    created() {
      // Start service on component creation
      this.toggleService
        .onTransition(state => {
          this.current = state;
        })
        .start();
    },
    data() {
      return {
        // Interpret machine and store it in data
        toggleService: interpret(toggleMachine),

        // Start with machine's initial state
        current: toggleMachine.initialState
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
