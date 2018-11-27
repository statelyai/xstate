## Vue

Vue follows a similar pattern to [React](recipes/react.md):

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
      this.toggleService
        .onTransition(state => {
          this.current = state;
        })
        .start();
    },
    data() {
      return {
        toggleService: interpret(toggleMachine),
        current: toggleMachine.initialState
      };
    },
    methods: {
      send(event) {
        this.toggleService.send(event);
      }
    }
  };
</script>
```
